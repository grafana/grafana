import { FieldType } from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';

import { ExpressionQueryType } from '../../types';

import { classifySchemaFields, getDynamicThresholdSourceOptions } from './sourcePreview';

describe('dynamic threshold source preview', () => {
  it('offers datasource-backed queries and excludes expressions and self', () => {
    const options = getDynamicThresholdSourceOptions(
      [
        {
          refId: 'A',
          queryType: '',
          datasourceUid: 'prometheus',
          model: { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
        },
        {
          refId: 'B',
          queryType: '',
          datasourceUid: ExpressionDatasourceRef.uid,
          model: {
            refId: 'B',
            datasource: ExpressionDatasourceRef,
            type: ExpressionQueryType.reduce,
          },
        },
        {
          refId: 'C',
          queryType: '',
          datasourceUid: 'loki',
          model: { refId: 'C', datasource: { uid: 'loki', type: 'loki' } },
        },
      ],
      'C'
    );

    expect(options).toEqual([{ value: 'A', label: 'A' }]);
  });

  it('separates numeric and string schema fields', () => {
    const fields = classifySchemaFields([
      { name: 'value', mysqlType: 'DOUBLE', dataFrameFieldType: FieldType.number, nullable: false },
      { name: 'region', mysqlType: 'VARCHAR', dataFrameFieldType: FieldType.string, nullable: true },
      { name: 'time', mysqlType: 'DATETIME', dataFrameFieldType: FieldType.time, nullable: false },
    ]);

    expect(fields).toEqual({ numericFields: ['value'], stringFields: ['region'] });
  });
});
