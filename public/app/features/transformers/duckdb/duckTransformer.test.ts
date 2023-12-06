import {
  DataFrame,
  DataFrameDTO,
  FieldType,
  toDataFrame,
  toDataFrameDTO,
  transformDataFrame,
  DataTransformerConfig,
  DataTransformerID,
  standardTransformersRegistry,
} from '@grafana/data';

import { getStandardTransformers } from '../standardTransformers';

import { DuckTransformerOptions, QueryType } from './duckTransformer';

describe('DuckDB transformation', () => {
  // Make sure it reads the local registry
  standardTransformersRegistry.setInit(getStandardTransformers);

  it('it should execute a simple query', async () => {
    const source = [
      toDataFrame({
        name: 'data',
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 1, 2, 3, 4, 5] },
          { name: 'value', type: FieldType.number, values: [0, 1, 2, 3, 4, 5] },
        ],
      }),
    ];

    const cfg: DataTransformerConfig<DuckTransformerOptions> = {
      id: DataTransformerID.duckdb,
      options: {
        type: QueryType.sql,
        query: 'SELECT * FROM A LIMIT 2',
      },
    };

    await expect(transformDataFrame([cfg], source)).toEmitValuesWith((received) => {
      const result = received[0];
      expect(toEquableDataFrames(result)).toBe([
        toDataFrame({
          name: 'data',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 1] }, // first two rows
            { name: 'value', type: FieldType.number, values: [0, 1] },
          ],
        }),
      ]);
    });
  });
});

function toEquableDataFrames(data: DataFrame[]): DataFrameDTO[] {
  return data.map((frame) => toDataFrameDTO(frame));
}
