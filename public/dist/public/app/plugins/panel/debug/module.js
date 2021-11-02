import { PanelPlugin } from '@grafana/data';
import { DebugPanel } from './DebugPanel';
import { StateViewEditor } from './StateView';
import { DebugMode } from './types';
export var plugin = new PanelPlugin(DebugPanel).useFieldConfig().setPanelOptions(function (builder) {
    builder
        .addSelect({
        path: 'mode',
        name: 'Mode',
        defaultValue: DebugMode.Render,
        settings: {
            options: [
                { label: 'Render', value: DebugMode.Render },
                { label: 'Events', value: DebugMode.Events },
                { label: 'Cursor', value: DebugMode.Cursor },
                { label: 'Cursor', value: DebugMode.Cursor },
                { label: 'Share state', value: DebugMode.State },
                { label: 'Throw error', value: DebugMode.ThrowError },
            ],
        },
    })
        .addCustomEditor({
        id: 'stateView',
        path: 'stateView',
        name: 'State view',
        defaultValue: '',
        showIf: function (_a) {
            var mode = _a.mode;
            return mode === DebugMode.State;
        },
        editor: StateViewEditor,
    })
        .addBooleanSwitch({
        path: 'counters.render',
        name: 'Render Count',
        defaultValue: true,
        showIf: function (_a) {
            var mode = _a.mode;
            return mode === DebugMode.Render;
        },
    })
        .addBooleanSwitch({
        path: 'counters.dataChanged',
        name: 'Data Changed Count',
        defaultValue: true,
        showIf: function (_a) {
            var mode = _a.mode;
            return mode === DebugMode.Render;
        },
    })
        .addBooleanSwitch({
        path: 'counters.schemaChanged',
        name: 'Schema Changed Count',
        defaultValue: true,
        showIf: function (_a) {
            var mode = _a.mode;
            return mode === DebugMode.Render;
        },
    })
        .addDashboardPicker({
        path: 'dashboardUID',
        name: 'Dashboard',
        settings: {
            placeholder: 'Select dashboard',
            isClearable: true,
        },
    });
});
//# sourceMappingURL=module.js.map