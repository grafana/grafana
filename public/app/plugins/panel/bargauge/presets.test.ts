import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { barGaugePresetsSupplier } from './presets';

describe('barGaugePresetsSupplier', () => {
  it('returns empty array when dataSummary is undefined', () => {
    expect(barGaugePresetsSupplier({ dataSummary: undefined })).toEqual([]);
  });

  it('returns empty array when there is no data', () => {
    expect(barGaugePresetsSupplier({ dataSummary: getPanelDataSummary([]) })).toEqual([]);
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
    expect(barGaugePresetsSupplier({ dataSummary: summary })).toEqual([]);
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
    expect(barGaugePresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns presets when data has number fields with rows', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);
    const result = barGaugePresetsSupplier({ dataSummary: summary });
    expect(result).not.toEqual([]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Basic' }),
        expect.objectContaining({ name: 'Gradient' }),
        expect.objectContaining({ name: 'Retro LCD' }),
      ])
    );
  });
});
