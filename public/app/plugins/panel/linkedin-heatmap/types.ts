export type LHeatmapOptions = any;

export const defaults: LHeatmapOptions = {
  valueMappings: [],
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
};
