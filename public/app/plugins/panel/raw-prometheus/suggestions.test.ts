import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { rawPrometheusSuggestionsSupplier } from './suggestions';

describe('Raw Prometheus panel suggestions', () => {
  it('does not suggest if no data is present', () => {
    expect(rawPrometheusSuggestionsSupplier(getPanelDataSummary([]))).toBeFalsy();
    expect(rawPrometheusSuggestionsSupplier(getPanelDataSummary(undefined))).toBeFalsy();
    expect(
      rawPrometheusSuggestionsSupplier(
        getPanelDataSummary([
          createDataFrame({
            fields: [
              { name: 'label', type: FieldType.string, values: [] },
              { name: 'value', type: FieldType.number, values: [] },
            ],
          }),
        ])
      )
    ).toBeFalsy();
  });

  it('does not suggest for multiple frames', () => {
    const suggestions = rawPrometheusSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'label', type: FieldType.string, values: ['metric1'] },
            { name: 'value', type: FieldType.number, values: [100] },
          ],
        }),
        createDataFrame({
          fields: [
            { name: 'label', type: FieldType.string, values: ['metric2'] },
            { name: 'value', type: FieldType.number, values: [200] },
          ],
        }),
      ])
    );
    expect(suggestions).toHaveLength(0);
  });

  it('does not suggest when time field is present', () => {
    const suggestions = rawPrometheusSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1609459200000] },
            { name: 'label', type: FieldType.string, values: ['metric1'] },
            { name: 'value', type: FieldType.number, values: [100] },
          ],
        }),
      ])
    );
    expect(suggestions).toHaveLength(0);
  });

  it('does not suggest without string field', () => {
    const suggestions = rawPrometheusSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [{ name: 'value', type: FieldType.number, values: [100] }],
        }),
      ])
    );
    expect(suggestions).toHaveLength(0);
  });

  it('does not suggest without number field', () => {
    const suggestions = rawPrometheusSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [{ name: 'label', type: FieldType.string, values: ['metric1'] }],
        }),
      ])
    );
    expect(suggestions).toHaveLength(0);
  });

  it('suggests for typical instant query result', () => {
    const suggestions = rawPrometheusSuggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: '__name__', type: FieldType.string, values: ['up', 'up', 'up'] },
            {
              name: 'instance',
              type: FieldType.string,
              values: ['localhost:9090', 'localhost:9091', 'localhost:9092'],
            },
            { name: 'job', type: FieldType.string, values: ['prometheus', 'prometheus', 'prometheus'] },
            { name: 'Value', type: FieldType.number, values: [1, 1, 0] },
          ],
        }),
      ])
    );
    expect(suggestions).toEqual([expect.objectContaining({ name: 'Raw Prometheus' })]);
  });
});
