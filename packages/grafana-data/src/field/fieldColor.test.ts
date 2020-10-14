import { Field, GrafanaThemeType, GrafanaTheme, FieldColorModeId } from '../types';
import { fieldColorModeRegistry, FieldValueColorCalculator } from './fieldColor';

describe('fieldColorModeRegistry', () => {
  interface GetCalcOptions {
    mode: string;
    seriesIndex?: number;
  }

  function getCalculator(options: GetCalcOptions): FieldValueColorCalculator {
    const mode = fieldColorModeRegistry.get(options.mode);
    return mode.getCalculator(
      { state: { seriesIndex: options.seriesIndex } } as Field,
      { type: GrafanaThemeType.Dark } as GrafanaTheme
    );
  }

  it('Schemes should interpolate', () => {
    const calcFn = getCalculator({ mode: 'continuous-GrYlRd' });
    expect(calcFn(70, 0.5, undefined)).toEqual('rgb(226, 192, 61)');
  });

  it('Palette classic with series index 0', () => {
    const calcFn = getCalculator({ mode: FieldColorModeId.PaletteClassic, seriesIndex: 0 });
    expect(calcFn(70, 0, undefined)).toEqual('#7EB26D');
  });

  it('Palette classic with series index 1', () => {
    const calcFn = getCalculator({ mode: FieldColorModeId.PaletteClassic, seriesIndex: 1 });
    expect(calcFn(70, 0, undefined)).toEqual('#EAB839');
  });
});
