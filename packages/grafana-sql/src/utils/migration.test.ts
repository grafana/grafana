import { QueryFormat } from '../types';

import migrateAnnotation from './migration';

describe('Annotation migration', () => {
  const annotation = {
    datasource: {
      uid: 'P4FDCC188E688367F',
      type: 'mysql',
    },
    enable: false,
    hide: false,
    iconColor: 'rgba(0, 211, 255, 1)',
    limit: 100,
    name: 'Single',
    rawQuery:
      "SELECT\n  createdAt as time,\n  'single' as text,\n hostname as tags\nFROM\n   grafana_metric\nWHERE\n  $__timeFilter(createdAt)\nORDER BY time\nLIMIT 1\n",
    showIn: 0,
    tags: [],
    type: 'tags',
  };

  it('should migrate from old format to new', () => {
    const newAnnotationFormat = migrateAnnotation(annotation);
    expect(newAnnotationFormat.target?.format).toBe(QueryFormat.Table);
    expect(newAnnotationFormat.target?.rawSql).toBe(annotation.rawQuery);
  });
});
