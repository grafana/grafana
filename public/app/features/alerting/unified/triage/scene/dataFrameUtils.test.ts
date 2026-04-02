import { FieldType, toDataFrame } from '@grafana/data';

import { dataFrameToLabelMaps } from './dataFrameUtils';

describe('dataFrameToLabelMaps', () => {
  it('should convert DataFrame rows to label maps', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'team', type: FieldType.string, values: ['infra', 'platform'] },
        { name: 'env', type: FieldType.string, values: ['prod', 'staging'] },
      ],
    });

    expect(dataFrameToLabelMaps(frame)).toEqual([
      { team: 'infra', env: 'prod' },
      { team: 'platform', env: 'staging' },
    ]);
  });

  it('should skip empty string values (label not present on that series)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'team', type: FieldType.string, values: ['infra', 'platform', ''] },
        { name: 'env', type: FieldType.string, values: ['prod', '', 'staging'] },
      ],
    });

    expect(dataFrameToLabelMaps(frame)).toEqual([
      { team: 'infra', env: 'prod' },
      { team: 'platform' },
      { env: 'staging' },
    ]);
  });

  it('should skip null and undefined values', () => {
    const frame = toDataFrame({
      fields: [{ name: 'team', type: FieldType.string, values: ['infra', null, undefined] }],
    });

    expect(dataFrameToLabelMaps(frame)).toEqual([{ team: 'infra' }, {}, {}]);
  });

  it('should only include string-type fields', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'team', type: FieldType.string, values: ['infra'] },
        { name: 'Value', type: FieldType.number, values: [42] },
      ],
    });

    expect(dataFrameToLabelMaps(frame)).toEqual([{ team: 'infra' }]);
  });

  it('should return empty array for empty frame', () => {
    const frame = toDataFrame({ fields: [] });
    expect(dataFrameToLabelMaps(frame)).toEqual([]);
  });
});
