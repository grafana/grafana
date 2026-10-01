import { type NotebookElement, type PanelElement, type Spec as NotebookSpec } from '../types';

/** Used when a panel has no title, or a title that slugifies to nothing (e.g. all non-latin). */
const FALLBACK_ELEMENT_NAME = 'panel';

/** Long enough to stay recognisable in a spec, short enough that the suffix stays readable. */
const MAX_SLUG_LENGTH = 50;

/**
 * Appends a panel to a notebook spec, minting the element name and panel id it needs to coexist with
 * what is already there.
 *
 * Pure and spec-level on purpose: the caller is on a dashboard or in Explore, so there is no
 * NotebookScene to mutate — the target notebook is fetched, appended to, and written back. Once cells
 * can be inserted in-scene, NotebookLayoutManager can call this too rather than growing a second
 * generator (see the note in serialization/transformNotebookSceneToSaveModel.ts).
 */
export function appendPanelToNotebook(spec: NotebookSpec, panel: PanelElement): NotebookSpec {
  const elementName = uniqueElementName(panel.spec.title, spec.elements);

  return {
    ...spec,
    elements: {
      ...spec.elements,
      [elementName]: withPanelId(panel, nextPanelId(spec.elements)),
    },
    layout: {
      ...spec.layout,
      spec: {
        ...spec.layout.spec,
        cells: [
          ...spec.layout.spec.cells,
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: elementName }, source: 'user' },
          },
        ],
      },
    },
  };
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
function uniqueElementName(title: string | undefined, elements: Record<string, NotebookElement>): string {
  const base = slugify(title ?? '') || FALLBACK_ELEMENT_NAME;

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
