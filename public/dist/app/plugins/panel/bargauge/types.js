import { VizOrientation } from '@grafana/ui';
export var orientationOptions = [
    { value: VizOrientation.Horizontal, label: 'Horizontal' },
    { value: VizOrientation.Vertical, label: 'Vertical' },
];
export var defaults = {
    minValue: 0,
    maxValue: 100,
    orientation: VizOrientation.Horizontal,
    valueOptions: {
        unit: 'none',
        stat: 'avg',
        prefix: '',
        suffix: '',
        decimals: null,
    },
    thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
    valueMappings: [],
};
//# sourceMappingURL=types.js.map