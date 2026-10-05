import { type NotebookElement, type Spec as NotebookSpec } from '../types';

const NOTE_ELEMENT_NAME = 'note';

export function appendNoteToNotebook(spec: NotebookSpec, text: string): NotebookSpec {
  const note = text.trim();
  if (!note) {
    return spec;
  }

  const elementName = uniqueElementName(spec.elements);

  return {
    ...spec,
    elements: {
      ...spec.elements,
      [elementName]: {
        kind: 'Cell',
        spec: { content: { kind: 'Markdown', spec: { text: note } } },
      },
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

function uniqueElementName(elements: Record<string, NotebookElement>): string {
  let candidate = NOTE_ELEMENT_NAME;
  let suffix = 1;

  while (Object.hasOwn(elements, candidate)) {
    suffix++;
    candidate = `${NOTE_ELEMENT_NAME}-${suffix}`;
  }

  return candidate;
}
