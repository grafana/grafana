import { sharedSingleStatPanelChangedHandler, BigValueGraphMode, BigValueColorMode } from '@grafana/ui';
import { FieldColorModeId } from '@grafana/data';
import { BigValueTextMode } from '@grafana/ui/src/components/BigValue/BigValue';
// This is called when the panel changes from another panel
export var statPanelChangedHandler = function (panel, prevPluginId, prevOptions) {
    var _a, _b;
    // This handles most config changes
    var options = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions);
    // Changing from angular singlestat
    if (prevOptions.angular && (prevPluginId === 'singlestat' || prevPluginId === 'grafana-singlestat-panel')) {
        var oldOptions = prevOptions.angular;
        options.graphMode = BigValueGraphMode.None;
        if (oldOptions.sparkline && oldOptions.sparkline.show) {
            options.graphMode = BigValueGraphMode.Area;
        }
        if (oldOptions.colorBackground) {
            options.colorMode = BigValueColorMode.Background;
        }
        else if (oldOptions.colorValue) {
            options.colorMode = BigValueColorMode.Value;
        }
        else {
            options.colorMode = BigValueColorMode.None;
            if (((_a = oldOptions.sparkline) === null || _a === void 0 ? void 0 : _a.lineColor) && options.graphMode === BigValueGraphMode.Area) {
                var cfg = (_b = panel.fieldConfig) !== null && _b !== void 0 ? _b : {};
                cfg.defaults.color = {
                    mode: FieldColorModeId.Fixed,
                    fixedColor: oldOptions.sparkline.lineColor,
                };
                panel.fieldConfig = cfg;
            }
        }
        if (oldOptions.valueName === 'name') {
            options.textMode = BigValueTextMode.Name;
        }
    }
    return options;
};
//# sourceMappingURL=StatMigrations.js.map