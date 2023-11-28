export * from './panelcfg.gen';
import { AxisPlacement, HeatmapCellLayout } from '@grafana/schema';
import { defaultOptions as defaultOptionsGen, HeatmapColorMode, HeatmapColorScale } from './panelcfg.gen';
export const defaultOptions = Object.assign(Object.assign({}, defaultOptionsGen), { color: Object.assign(Object.assign({}, defaultOptionsGen.color), { mode: HeatmapColorMode.Scheme, scale: HeatmapColorScale.Exponential }), yAxis: Object.assign(Object.assign({}, defaultOptionsGen.yAxis), { axisPlacement: AxisPlacement.Left }), rowsFrame: Object.assign(Object.assign({}, defaultOptionsGen.rowsFrame), { layout: HeatmapCellLayout.auto }) });
//# sourceMappingURL=types.js.map