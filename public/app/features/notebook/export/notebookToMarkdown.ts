import {
  type CellContentKind,
  type NotebookElement,
  type NotebookLayoutItemKind,
  type PanelQueryKind,
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

  // `layout.spec.cells` is the ordered list; `elements` is an unordered Record that two layout items
  // may legitimately both point at. Iterating elements would lose the order and drop duplicates, so
  // walk the layout and dereference — the same traversal deserializeNotebookLayout does.
  for (const item of spec.layout.spec.cells) {
    const element = spec.elements[item.spec.element.name];
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
  if (spec.tags.length > 0) {
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
      return panelToMarkdown(element.spec.title, element.spec.data.spec.queries);
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
 */
function panelToMarkdown(title: string, queries: PanelQueryKind[]): string {
  const heading = `### ${title}`;

  if (queries.length === 0) {
    return `${heading}\n\n_Panel with no queries._`;
  }

  const described = queries.map((query) => ({
    refId: query.spec.refId,
    // A disabled query would otherwise read as one the panel is actually running.
    hidden: query.spec.hidden,
    datasource: query.spec.query.datasource?.name,
    // Nested rather than spread: a datasource's own query model commonly carries its own refId and
    // hidden, which merging would silently overwrite these with.
    query: query.spec.query.spec,
  }));

  return `${heading}\n\n${fence(JSON.stringify(described, null, 2), 'json')}`;
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
