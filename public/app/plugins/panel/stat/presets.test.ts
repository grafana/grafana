import { createDataFrame, FieldType } from '@grafana/data/dataframe';
import { getPanelDataSummary } from '@grafana/data/panel';

import { statPresetsSupplier } from './presets';

describe('statPresetsSupplier', () => {
  it('returns empty array when dataSummary is undefined', () => {
    expect(statPresetsSupplier({ dataSummary: undefined })).toEqual([]);
  });

  it('returns empty array when there is no data', () => {
    expect(statPresetsSupplier({ dataSummary: getPanelDataSummary([]) })).toEqual([]);
  });

  it('returns empty array when frames have no rows', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [] },
          { name: 'value', type: FieldType.number, values: [] },
        ],
      }),
    ]);
    expect(statPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns empty array when there are no number fields', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'status', type: FieldType.string, values: ['ok', 'err', 'ok'] },
        ],
      }),
    ]);
    expect(statPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns presets for a single series with number fields', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);
    const result = statPresetsSupplier({ dataSummary: summary });
    expect(result!.length).toBeGreaterThan(0);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Threshold value' }),
        expect.objectContaining({ name: 'Threshold value with sparkline' }),
      ])
    );
  });

  it('returns different presets for few series', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value2', type: FieldType.number, values: [40, 50, 60] },
        ],
      }),
    ]);
    const result = statPresetsSupplier({ dataSummary: summary });
    expect(result!.length).toBeGreaterThan(0);
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Horizontal threshold value' })]));
  });
});
