import { LegendDisplayMode } from '@grafana/schema';
import { defaultOptions as defaultOptionsBase, defaultCandlestickColors, CandleStyle, ColorStrategy, VizDisplayMode, } from './panelcfg.gen';
export const defaultOptions = Object.assign(Object.assign({}, defaultOptionsBase), { 
    // TODO: This should be included in the cue schema in the future.
    legend: {
        displayMode: LegendDisplayMode.List,
        showLegend: true,
        placement: 'bottom',
        calcs: [],
    } });
export { defaultCandlestickColors, CandleStyle, ColorStrategy, VizDisplayMode, };
//# sourceMappingURL=types.js.map