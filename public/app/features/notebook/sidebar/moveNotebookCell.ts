import { type Spec as NotebookSpec } from '../types';

export function moveNotebookCell(spec: NotebookSpec, elementName: string, destinationIndex: number): NotebookSpec {
  const cells = spec.layout.spec.cells;
  const sourceIndex = cells.findIndex((cell) => cell.spec.element.name === elementName);
  const targetIndex = Math.max(0, Math.min(destinationIndex, cells.length - 1));

  if (sourceIndex < 0 || sourceIndex === targetIndex) {
    return spec;
  }

  const reordered = [...cells];
  const [cell] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, cell);

  return {
    ...spec,
    layout: {
      ...spec.layout,
      spec: {
        ...spec.layout.spec,
        cells: reordered,
      },
    },
  };
}
