import {
  type CellKind,
  type NotebookElement,
  type NotebookLayoutItemKind,
  type PanelElement,
  type Spec as NotebookSpec,
} from '../types';

/** Used when a panel has no title, or a title that slugifies to nothing (e.g. all non-latin). */
const FALLBACK_ELEMENT_NAME = 'panel';
const MARKDOWN_ELEMENT_NAME = 'markdown';

/** One cell to append, in document order. */
export type AppendedElement =
  // `isLibraryPanel` is for analytics only: a library panel is inlined by the time it gets here.
  { kind: 'panel'; panel: PanelElement; isLibraryPanel?: boolean } | { kind: 'markdown'; text: string };

/** Who authored an appended cell: the person adding it, or an assistant whose content they added. */
export type AppendedCellSource = NotebookLayoutItemKind['spec']['source'];

/** Long enough to stay recognisable in a spec, short enough that the suffix stays readable. */
const MAX_SLUG_LENGTH = 50;

/**
 * Appends cells in order, minting the element names and panel ids they need to coexist with what is
 * already there. Names and panel ids stay unique across the batch as well as the notebook.
 *
 * Pure and spec-level on purpose: a caller on a dashboard or in Explore has no NotebookScene to mutate,
 * so the target notebook is fetched, appended to, and written back.
 */
export function appendElementsToNotebook(
  spec: NotebookSpec,
  appended: AppendedElement[],
  source: AppendedCellSource = 'user'
): NotebookSpec {
  const elements = { ...spec.elements };
  const cells = [...spec.layout.spec.cells];
  let panelId = nextPanelId(elements);

  for (const item of appended) {
    const name =
      item.kind === 'panel'
        ? uniqueElementName(item.panel.spec.title, elements, FALLBACK_ELEMENT_NAME)
        : uniqueElementName(undefined, elements, MARKDOWN_ELEMENT_NAME);
    elements[name] = item.kind === 'panel' ? withPanelId(item.panel, panelId++) : markdownCell(item.text);
    cells.push({ kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name }, source } });
  }

  return { ...spec, elements, layout: { ...spec.layout, spec: { ...spec.layout.spec, cells } } };
}

function markdownCell(text: string): CellKind {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

/**
 * The deserializer takes the id straight off the spec, so a duplicate would collide in
 * getVizPanelKeyForPanelId and make findVizPanelByKey return the wrong cell's panel.
 *
 * Max+1 rather than a count: a notebook that has had a cell deleted has gaps, and counting would
 * hand back an id that is already in use.
 */
function nextPanelId(elements: Record<string, NotebookElement>): number {
  let highest = 0;

  for (const element of Object.values(elements)) {
    if (element.kind === 'Panel' || element.kind === 'LibraryPanel') {
      highest = Math.max(highest, element.spec.id);
    }
  }

  return highest + 1;
}

/** Both branches are identical; the union has to be narrowed before its `spec` can be spread. */
function withPanelId(panel: PanelElement, id: number): PanelElement {
  if (panel.kind === 'LibraryPanel') {
    return { ...panel, spec: { ...panel.spec, id } };
  }

  return { ...panel, spec: { ...panel.spec, id } };
}

/**
 * Own keys only. `in` would report true for `constructor`, `toString` and the rest of
 * Object.prototype, so a panel titled "Constructor" would be treated as colliding forever.
 */
function uniqueElementName(
  title: string | undefined,
  elements: Record<string, NotebookElement>,
  fallback: string
): string {
  const base = slugify(title ?? '') || fallback;

  let candidate = base;
  let suffix = 1;
  while (Object.hasOwn(elements, candidate)) {
    suffix++;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, MAX_SLUG_LENGTH)
      // After the slice, so a truncated slug can't end on the separator.
      .replace(/^-+|-+$/g, '')
  );
}
