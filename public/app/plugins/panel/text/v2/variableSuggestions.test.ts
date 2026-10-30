import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { DataLinkBuiltInVars, FieldType, toDataFrame, VariableOrigin } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { RenderMode } from '../panelcfg.gen';

import { getTextVariableSuggestions } from './variableSuggestions';

const series = [
  toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1, 2] },
      { name: 'cpu', type: FieldType.number, values: [40, 75] },
    ],
  }),
];

function valuesOf(renderMode?: RenderMode) {
  return getTextVariableSuggestions(series, renderMode).map((suggestion) => suggestion.value);
}

describe('getTextVariableSuggestions', () => {
  beforeAll(() => {
    // Dashboard variables are offered alongside the data macros.
    initTemplateSrv('hello', []);
  });

  beforeEach(() => {
    setTestFlags({ [FlagKeys.TextNewFeatures]: true });
  });

  afterAll(() => {
    setTestFlags({});
  });

  it.each([
    ['Once', RenderMode.Once],
    ['an undefined render mode', undefined],
  ])('offers field macros with a reducer for %s, since there is no row', (_name, renderMode) => {
    const fields = getTextVariableSuggestions(series, renderMode).filter((s) => s.origin === VariableOrigin.Fields);

    expect(fields.map((s) => s.value)).toEqual(
      expect.arrayContaining(['__data.fields.cpu:reduce:lastNotNull', '__data.fields[0]:reduce:lastNotNull'])
    );
    expect(fields.every((s) => s.value.endsWith(':reduce:lastNotNull'))).toBe(true);
  });

  it('leaves out the row timestamp when rendering once', () => {
    expect(valuesOf(RenderMode.Once)).not.toContain(DataLinkBuiltInVars.valueTime);
  });

  it('keeps the suggestions unchanged when the text.newFeatures flag is off', () => {
    setTestFlags({ [FlagKeys.TextNewFeatures]: false });
    const values = valuesOf(RenderMode.Once);

    expect(values).toEqual(expect.arrayContaining(['__data.fields.cpu', DataLinkBuiltInVars.valueTime]));
    expect(values.some((value) => value.includes(':reduce:'))).toBe(false);
  });

  it('keeps row macros unchanged when rendering every row', () => {
    const values = valuesOf(RenderMode.PerRow);

    expect(values).toEqual(expect.arrayContaining(['__data.fields.cpu', DataLinkBuiltInVars.valueTime]));
    expect(values.some((value) => value.includes(':reduce:'))).toBe(false);
  });
});
