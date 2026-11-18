import { syntaxTree } from '@codemirror/language';
import { type EditorState } from '@codemirror/state';

export interface AnnotationValue {
  from: number;
  to: number;
  widgetPos: number;
  value?: string;
}

export const annotationNames = ['grafana.app/folder', 'grafana.app/createdBy', 'grafana.app/updatedBy'] as const;
export type AnnotationName = (typeof annotationNames)[number];

export function annotationValues(state: EditorState): Map<AnnotationName, AnnotationValue> {
  let object = syntaxTree(state).topNode.getChild('Object');
  for (const name of ['metadata', 'annotations']) {
    const property = object?.getChildren('Property').find((property) => {
      const key = property.getChild('PropertyName');
      return key && parseString(state.sliceDoc(key.from, key.to)) === name;
    });
    object = property?.getChild('Object') ?? null;
  }
  const values = new Map<AnnotationName, AnnotationValue>();
  for (const property of object?.getChildren('Property') ?? []) {
    const key = property.getChild('PropertyName');
    const name = key && parseString(state.sliceDoc(key.from, key.to));
    const annotation = annotationNames.find((candidate) => candidate === name);
    const value = property.getChild('String');
    if (annotation && value && !values.has(annotation)) {
      values.set(annotation, {
        from: value.from,
        to: value.to,
        widgetPos: property.nextSibling?.name === ',' ? property.nextSibling.to : value.to,
        value: parseString(state.sliceDoc(value.from, value.to)),
      });
    }
  }
  return values;
}

function parseString(text: string): string | undefined {
  try {
    return JSON.parse(text);
  } catch {
    // Incomplete strings are expected while editing JSON.
    return undefined;
  }
}
