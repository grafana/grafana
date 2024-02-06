import { AnnotationQuery } from '@grafana/data';

import { applyQueryDefaults } from '../defaults';
import { SQLQuery } from '../types';

export default function migrateAnnotation(annotation: AnnotationQuery<SQLQuery>) {
  const oldQuery = typeof annotation.rawQuery === 'string' ? annotation.rawQuery : null;

  if (!oldQuery) {
    return annotation;
  }

  const newQuery = applyQueryDefaults({ refId: 'Annotation', ...(annotation.target ?? {}), rawSql: oldQuery });

  return {
    ...annotation,
    rawQuery: undefined,
    workspace: undefined,
    subscription: undefined,
    queryType: undefined,
    target: newQuery,
  };
}
