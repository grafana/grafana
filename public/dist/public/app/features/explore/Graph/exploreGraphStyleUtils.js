import { produce } from 'immer';
import { GraphDrawStyle, StackingMode } from '@grafana/schema';
export function applyGraphStyle(config, style, maximum) {
    return produce(config, (draft) => {
        if (draft.defaults.custom === undefined) {
            draft.defaults.custom = {};
        }
        draft.defaults.max = maximum;
        const { custom } = draft.defaults;
        if (custom.stacking === undefined) {
            custom.stacking = { group: 'A' };
        }
        switch (style) {
            case 'lines':
                custom.drawStyle = GraphDrawStyle.Line;
                custom.stacking.mode = StackingMode.None;
                custom.fillOpacity = 0;
                break;
            case 'bars':
                custom.drawStyle = GraphDrawStyle.Bars;
                custom.stacking.mode = StackingMode.None;
                custom.fillOpacity = 100;
                break;
            case 'points':
                custom.drawStyle = GraphDrawStyle.Points;
                custom.stacking.mode = StackingMode.None;
                custom.fillOpacity = 0;
                break;
            case 'stacked_lines':
                custom.drawStyle = GraphDrawStyle.Line;
                custom.stacking.mode = StackingMode.Normal;
                custom.fillOpacity = 100;
                custom.axisSoftMin = 0;
                break;
            case 'stacked_bars':
                custom.drawStyle = GraphDrawStyle.Bars;
                custom.stacking.mode = StackingMode.Normal;
                custom.fillOpacity = 100;
                custom.axisSoftMin = 0;
                break;
            default: {
                // should never happen
                // NOTE: casting to `never` will cause typescript
                // to verify that the switch statement checks every possible
                // enum-value
                const invalidValue = style;
                throw new Error(`Invalid graph-style: ${invalidValue}`);
            }
        }
    });
}
export function applyThresholdsConfig(config, thresholdsStyle, thresholdsConfig) {
    return produce(config, (draft) => {
        var _a;
        draft.defaults.thresholds = thresholdsConfig;
        draft.defaults.custom = (_a = draft.defaults.custom) !== null && _a !== void 0 ? _a : {};
        draft.defaults.custom.thresholdsStyle = thresholdsStyle;
    });
}
//# sourceMappingURL=exploreGraphStyleUtils.js.map