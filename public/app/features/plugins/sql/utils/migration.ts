import { AnnotationQuery } from '@grafana/data';

import { applyQueryDefaults } from '../defaults';
import { QueryFormat, SQLQuery } from '../types';

export default function migrateAnnotation(annotation: AnnotationQuery<SQLQuery>) {
  const oldQuery = typeof annotation.rawQuery === 'string' ? annotation.rawQuery : null;

  if (!oldQuery) {
    return annotation;
  }

  const newQuery = applyQueryDefaults({
    refId: 'Annotation',
    ...(annotation.target ?? {}),
    rawSql: oldQuery,
    format: QueryFormat.Table,
  });

  return {
    ...annotation,
    rawQuery: undefined,
    workspace: undefined,
    subscription: undefined,
    queryType: undefined,
    target: newQuery,
  };
}
