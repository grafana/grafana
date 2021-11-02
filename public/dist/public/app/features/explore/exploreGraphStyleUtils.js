import produce from 'immer';
import { GraphDrawStyle, StackingMode } from '@grafana/schema';
export function applyGraphStyle(config, style) {
    return produce(config, function (draft) {
        if (draft.defaults.custom === undefined) {
            draft.defaults.custom = {};
        }
        var custom = draft.defaults.custom;
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
                break;
            case 'stacked_bars':
                custom.drawStyle = GraphDrawStyle.Bars;
                custom.stacking.mode = StackingMode.Normal;
                custom.fillOpacity = 100;
                break;
            default: {
                // should never happen
                // NOTE: casting to `never` will cause typescript
                // to verify that the switch statement checks every possible
                // enum-value
                var invalidValue = style;
                throw new Error("Invalid graph-style: " + invalidValue);
            }
        }
    });
}
//# sourceMappingURL=exploreGraphStyleUtils.js.map