import { type NotebookElement, type Spec as NotebookSpec } from '../types';

export interface NotebookPreviewItem {
  elementName: string;
  kind: 'code' | 'note' | 'visualization';
  label: string;
}

export function getNotebookOutlineItems(spec: NotebookSpec): NotebookPreviewItem[] {
  return spec.layout.spec.cells.flatMap((cell) => {
    const elementName = cell.spec.element.name;
    const element = spec.elements[elementName];
    const item = element ? previewItem(elementName, element) : undefined;
    return item ? [item] : [];
  });
}

function previewItem(elementName: string, element: NotebookElement): NotebookPreviewItem | undefined {
  if (element.kind === 'Panel' || element.kind === 'LibraryPanel') {
    return {
      elementName,
      kind: 'visualization',
      label: element.spec.title?.trim() || 'Untitled visualization',
    };
  }

  if (element.spec.content.kind === 'Code') {
    const firstLine = element.spec.content.spec.code
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);

    return {
      elementName,
      kind: 'code',
      label: firstLine || `${element.spec.content.spec.language || 'Code'} block`,
    };
  }

  const label = element.spec.content.spec.text.replace(/\s+/g, ' ').trim();
  return { elementName, kind: 'note', label: label || 'Empty note' };
}
