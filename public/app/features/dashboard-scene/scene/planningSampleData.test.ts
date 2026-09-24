import { FieldType } from '@grafana/data';

import { getPlanningPanelData, getPlanningVariableValues } from './planningSampleData';

it.each([
  ['timeseries', [FieldType.time, FieldType.number, FieldType.number, FieldType.number]],
  ['piechart', [FieldType.string, FieldType.number]],
  ['candlestick', [FieldType.time, FieldType.number, FieldType.number, FieldType.number, FieldType.number]],
])('creates samples shaped for %s', (pluginId, types) => {
  const sample = getPlanningPanelData('CPU usage', pluginId);
  expect(sample.$data.state.data?.series[0].fields.map((field) => field.type)).toEqual(types);
});

it('keeps samples stable for the same title and uses the signal unit', () => {
  const first = getPlanningPanelData('CPU usage', 'timeseries');
  const second = getPlanningPanelData('CPU usage', 'timeseries');
  expect(first.$data.state.data?.series[0].fields[1].values).toEqual(
    second.$data.state.data?.series[0].fields[1].values
  );
  expect(first.fieldConfig.defaults.unit).toBe('percentunit');
});

it('generates a non-empty list of generic sample values for a stand-in variable', () => {
  const values = getPlanningVariableValues();

  expect(values.length).toBeGreaterThan(0);
  expect(new Set(values).size).toBe(values.length);
});
