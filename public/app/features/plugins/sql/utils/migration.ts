import { AnnotationQuery } from '@grafana/data';
import { EditorMode } from '@grafana/experimental';

import { SQLQuery } from '../types';

export default function migrateAnnotation(annotation: AnnotationQuery<SQLQuery>) {
  const oldQuery = typeof annotation.rawQuery === 'string' ? annotation.rawQuery : null;

  if (!oldQuery) {
    return annotation;
  }

  const newQuery: SQLQuery = {
    ...(annotation.target ?? {}),
    refId: annotation.target?.refId ?? 'Anno',
    editorMode: EditorMode.Code,
    rawSql: oldQuery,
  };

  return {
    ...annotation,
    rawQuery: undefined,
    workspace: undefined,
    subscription: undefined,
    queryType: undefined,
    target: newQuery,
  };
}
