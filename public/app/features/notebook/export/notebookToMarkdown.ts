import {
  type CellContentKind,
  type NotebookElement,
  type NotebookLayoutItemKind,
  type PanelKind,
  type Spec as NotebookSpec,
} from '../types';

interface NotebookExportMeta {
  /**
   * Absolute link back to the notebook, so an exported document can be traced to its source.
   *
   * Optional because the Cursor export leaves it out: Cursor's deep link handler mis-parses
   * embedded URLs. Omitting it here is safer than generating the link and stripping it back out,
   * which cannot tell the generated line from an identical line in the notebook's own prose.
   */
  url?: string;
}

/**
 * Renders a notebook as a standalone markdown document.
 *
 * Markdown cells already hold markdown, so most of this is assembly rather than conversion. The
 * interesting cases are panels, which have no markdown equivalent at all.
 */
export function notebookToMarkdown(spec: NotebookSpec, meta: NotebookExportMeta): string {
  const blocks = [buildHeader(spec, meta)];

  // Every collection here is guarded because Go marshals a nil slice or map as `null`, not as absent
  // — none of these fields carry `omitempty` — while the generated TS types claim they are always
  // present. It does not reproduce through the UI, where a notebook is created from
  // defaultNotebookSpec() and round-trips as `[]`; it reproduces for one made by the Assistant,
  // kubectl or provisioning, and the list row hands a raw API spec straight in.
  //
  // `layout.spec.cells` is the ordered list; `elements` is an unordered Record that two layout items
  // may legitimately both point at. Iterating elements would lose the order and drop duplicates, so
  // walk the layout and dereference — the same traversal deserializeNotebookLayout does.
  const elements = spec.elements ?? {};

  for (const item of spec.layout.spec.cells ?? []) {
    const element = elements[item.spec.element.name];
    // A layout item referencing a missing element is skipped rather than fatal, matching the
    // deserializer: a partially broken notebook should still export what it has.
    if (!element) {
      continue;
    }

    const block = elementToMarkdown(element, item);
    if (block) {
      blocks.push(block);
    }
  }

  return blocks.join('\n\n');
}

function buildHeader(spec: NotebookSpec, meta: NotebookExportMeta): string {
  const lines = [`# ${spec.title}`, ''];

  if (spec.description) {
    lines.push(spec.description, '');
  }
  if (spec.tags?.length) {
    lines.push(`- **Tags:** ${spec.tags.join(', ')}`);
  }

  lines.push(`- **Time range:** ${spec.timeSettings.from} to ${spec.timeSettings.to}`);
  if (meta.url) {
    lines.push(`- **Link:** [Open in Grafana](${meta.url})`);
  }

  return `${lines.join('\n')}\n\n---`;
}

function elementToMarkdown(element: NotebookElement, item: NotebookLayoutItemKind): string | undefined {
  switch (element.kind) {
    case 'Cell':
      return cellContentToMarkdown(element.spec.content);
    case 'Panel':
      return panelToMarkdown(element.spec);
    case 'LibraryPanel':
      return `### ${element.spec.title}\n\n_Library panel: ${element.spec.libraryPanel.name}_`;
    default:
      // Keeps an unrecognised element visible in the output instead of silently dropping it. Unlike
      // the deserializer this does not throw: a failed export is worse than an annotated one.
      return `<!-- unsupported notebook element: ${item.spec.element.name} -->`;
  }
}

function cellContentToMarkdown(content: CellContentKind): string {
  if (content.kind === 'Markdown') {
    // Emitted verbatim. Heading levels inside are deliberately left alone — shifting them to sit
    // under the document title would mean parsing the markdown, and getting that subtly wrong is
    // worse than a document with two H1s.
    return content.spec.text;
  }

  return fence(content.spec.code, content.spec.language);
}

/**
 * A chart cannot be markdown, so the queries behind it are emitted instead — the closest thing to
 * the panel's actual meaning, and the part a reader or a coding agent can act on.
 *
 * The viz type comes along because the queries alone do not say whether this was a time series, a
 * table or a single stat, and a transformation marker because they genuinely do not describe the
 * chart when one is present. Standing in for the chart is only defensible if the reader is told
 * where the substitution is incomplete.
 */
function panelToMarkdown(panel: PanelKind['spec']): string {
  const lines = [`### ${panel.title}`, '', `_${panel.vizConfig.group} panel_`];

  // The queries below are the panel's inputs; a transformation sits between them and what was on
  // screen, so a value the reader is looking for may not appear in any query here.
  const transformations = panel.data.spec.transformations ?? [];
  if (transformations.length > 0) {
    lines.push('', `<!-- ${transformations.length} transformation(s) applied; not represented below -->`);
  }

  const queries = panel.data.spec.queries ?? [];
  if (queries.length === 0) {
    lines.push('', '_Panel with no queries._');

    return lines.join('\n');
  }

  const described = queries.map((query) => ({
    refId: query.spec.refId,
    // Only when true. The point is that a disabled query would otherwise read as one the panel is
    // running; saying so on every active query is noise in every export.
    ...(query.spec.hidden && { hidden: true }),
    datasource: query.spec.query.datasource?.name,
    // The plugin id, which is what says whether `expr` below is PromQL, LogQL or something else.
    // Datasource names are user-chosen and may be absent, so this is the only reliable signal — and
    // for a document meant to be handed to a coding agent, the most valuable field in the block.
    type: query.spec.query.group,
    // Nested rather than spread: a datasource's own query model commonly carries its own refId and
    // hidden, which merging would silently overwrite these with.
    query: query.spec.query.spec,
  }));

  lines.push('', fence(JSON.stringify(described, null, 2), 'json'));

  return lines.join('\n');
}

function fence(body: string, language: string): string {
  // A body containing its own ``` run would end the block early, so the fence grows past the
  // longest run inside it — the same rule CommonMark uses. Tracked in a loop rather than spread
  // into Math.max, which a body with tens of thousands of runs would blow the argument limit on.
  let longestRun = 2;
  for (const match of body.matchAll(/`+/g)) {
    longestRun = Math.max(longestRun, match[0].length);
  }

  const delimiter = '`'.repeat(longestRun + 1);

  return `${delimiter}${infoString(language)}\n${body}\n${delimiter}`;
}

/**
 * The schema allows any string as a cell's language. A backtick or a line break in the fence's info
 * string breaks the opening delimiter, which would render the whole cell as prose — so an unusable
 * language is dropped rather than emitted.
 */
function infoString(language: string): string {
  return /[`\r\n]/.test(language) ? '' : language;
}
