import { DataTransformerConfig } from '@grafana/schema';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../../internal';
import { FieldType } from '../../types/dataFrame';
import { transformDataFrame } from '../transformDataFrame';

import { convertFrameTypeTransformer, ConvertFrameTypeTransformerOptions, FrameType } from './convertFrameType';
import { DataTransformerID } from './ids';

describe('convert frame type', () => {
  beforeAll(() => {
    mockTransformationsRegistry([convertFrameTypeTransformer]);
  });

  it('will convert a series frame into an exemplar frame', async () => {
    const seriesFrame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, 100] },
      ],
    });

    const cfg: DataTransformerConfig<ConvertFrameTypeTransformerOptions> = {
      id: DataTransformerID.convertFrameType,
      options: {
        targetType: FrameType.Exemplar,
      },
    };

    await expect(transformDataFrame([cfg], [seriesFrame])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed[0]).toEqual({
        name: 'exemplar',
        meta: { custom: { resultType: 'exemplar' }, dataTopic: 'annotations' },
        length: 2,
        fields: [
          { config: {}, name: 'Time', type: 'time', values: [1000, 2000] },
          { config: {}, name: 'Value', type: 'number', values: [1, 100] },
        ],
      });
    });
  });
});
