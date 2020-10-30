import { Field, FieldColorModeId } from '../types';
import { getTestTheme } from '../utils/testdata/testTheme';
import { fieldColorModeRegistry, FieldValueColorCalculator } from './fieldColor';

describe('fieldColorModeRegistry', () => {
  interface GetCalcOptions {
    mode: string;
    seriesIndex?: number;
  }

  function getCalculator(options: GetCalcOptions): FieldValueColorCalculator {
    const mode = fieldColorModeRegistry.get(options.mode);
    return mode.getCalculator({ state: { seriesIndex: options.seriesIndex } } as Field, getTestTheme());
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
