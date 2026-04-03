import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { timeseriesPresetsSupplier } from './presets';

describe('timeseriesPresetsSupplier', () => {
  it('returns empty array when dataSummary is undefined', () => {
    expect(timeseriesPresetsSupplier({ dataSummary: undefined })).toEqual([]);
  });

  it('returns empty array when there is no data', () => {
    expect(timeseriesPresetsSupplier({ dataSummary: getPanelDataSummary([]) })).toEqual([]);
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
    expect(timeseriesPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns empty array when there is no time field', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          { name: 'status', type: FieldType.string, values: ['ok', 'err', 'ok'] },
        ],
      }),
    ]);
    expect(timeseriesPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns empty array when there is no number field', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'status', type: FieldType.string, values: ['ok', 'err', 'ok'] },
        ],
      }),
    ]);
    expect(timeseriesPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns presets for a single series with few points', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);
    const result = timeseriesPresetsSupplier({ dataSummary: summary });
    expect(result!.length).toBeGreaterThan(0);
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]));
  });

  it('returns presets for multiple series', () => {
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
    const result = timeseriesPresetsSupplier({ dataSummary: summary });
    expect(result!.length).toBeGreaterThan(0);
  });
});
