import { __assign, __read } from "tslib";
import React, { useCallback } from 'react';
import { HorizontalGroup } from '@grafana/ui';
import { TransformationEditor } from './TransformationEditor';
import { QueryOperationRow, } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { PluginStateInfo } from 'app/features/plugins/PluginStateInfo';
import { useToggle } from 'react-use';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
export var TransformationOperationRow = function (_a) {
    var onRemove = _a.onRemove, index = _a.index, id = _a.id, data = _a.data, configs = _a.configs, uiConfig = _a.uiConfig, onChange = _a.onChange;
    var _b = __read(useToggle(false), 2), showDebug = _b[0], toggleDebug = _b[1];
    var _c = __read(useToggle(false), 2), showHelp = _c[0], toggleHelp = _c[1];
    var disabled = configs[index].transformation.disabled;
    var onDisableToggle = useCallback(function (index) {
        var current = configs[index].transformation;
        onChange(index, __assign(__assign({}, current), { disabled: current.disabled ? undefined : true }));
    }, [onChange, configs]);
    var renderActions = function (_a) {
        var isOpen = _a.isOpen;
        return (React.createElement(HorizontalGroup, { align: "center", width: "auto" },
            uiConfig.state && React.createElement(PluginStateInfo, { state: uiConfig.state }),
            React.createElement(QueryOperationAction, { title: "Show/hide transform help", icon: "info-circle", onClick: toggleHelp, active: showHelp }),
            React.createElement(QueryOperationAction, { title: "Debug", disabled: !isOpen, icon: "bug", onClick: toggleDebug, active: showDebug }),
            React.createElement(QueryOperationAction, { title: "Disable/Enable transformation", icon: disabled ? 'eye-slash' : 'eye', onClick: function () { return onDisableToggle(index); }, active: disabled }),
            React.createElement(QueryOperationAction, { title: "Remove", icon: "trash-alt", onClick: function () { return onRemove(index); } })));
    };
    return (React.createElement(QueryOperationRow, { id: id, index: index, title: uiConfig.name, draggable: true, actions: renderActions, disabled: disabled },
        showHelp && React.createElement(OperationRowHelp, { markdown: prepMarkdown(uiConfig) }),
        React.createElement(TransformationEditor, { debugMode: showDebug, index: index, data: data, configs: configs, uiConfig: uiConfig, onChange: onChange })));
};
function prepMarkdown(uiConfig) {
    var _a;
    var helpMarkdown = (_a = uiConfig.help) !== null && _a !== void 0 ? _a : uiConfig.description;
    return "\n" + helpMarkdown + "\n\nGo the <a href=\"https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana\" target=\"_blank\" rel=\"noreferrer\">\ntransformation documentation\n</a> for more.\n";
}
//# sourceMappingURL=TransformationOperationRow.js.map