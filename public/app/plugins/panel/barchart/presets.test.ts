import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { barchartPresetsSupplier } from './presets';

describe('barchartPresetsSupplier', () => {
  it('returns empty array when dataSummary is undefined', () => {
    expect(barchartPresetsSupplier({ dataSummary: undefined })).toEqual([]);
  });

  it('returns empty array when there is no data', () => {
    expect(barchartPresetsSupplier({ dataSummary: getPanelDataSummary([]) })).toEqual([]);
  });

  it('returns empty array when frames have no rows', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'category', type: FieldType.string, values: [] },
          { name: 'value', type: FieldType.number, values: [] },
        ],
      }),
    ]);
    expect(barchartPresetsSupplier({ dataSummary: summary })).toEqual([]);
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
    expect(barchartPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns presets when data has number fields', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);
    const result = barchartPresetsSupplier({ dataSummary: summary });
    expect(result!.length).toBeGreaterThan(0);
  });

  it('includes stacked preset when multiple number fields exist', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value1', type: FieldType.number, values: [10, 20, 30] },
          { name: 'value2', type: FieldType.number, values: [40, 50, 60] },
        ],
      }),
    ]);
    const result = barchartPresetsSupplier({ dataSummary: summary });
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Palette classic stacked' })]));
  });
});
