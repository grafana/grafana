import { type Spec as NotebookSpec } from '../types';

export function removeNotebookCell(spec: NotebookSpec, elementName: string): NotebookSpec {
  const index = spec.layout.spec.cells.findIndex((cell) => cell.spec.element.name === elementName);
  if (index < 0) {
    return spec;
  }

  const cells = [...spec.layout.spec.cells];
  cells.splice(index, 1);

  const elements = { ...spec.elements };
  if (!cells.some((cell) => cell.spec.element.name === elementName)) {
    delete elements[elementName];
  }

  return {
    ...spec,
    elements,
    layout: {
      ...spec.layout,
      spec: {
        ...spec.layout.spec,
        cells,
      },
    },
  };
}
