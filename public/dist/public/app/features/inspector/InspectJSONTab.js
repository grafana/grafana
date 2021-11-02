import { __assign, __extends, __rest } from "tslib";
import React, { PureComponent } from 'react';
import { chain } from 'lodash';
import { AppEvents } from '@grafana/data';
import { Button, CodeEditor, Field, Select } from '@grafana/ui';
import AutoSizer from 'react-virtualized-auto-sizer';
import { selectors } from '@grafana/e2e-selectors';
import { appEvents } from 'app/core/core';
import { getPanelInspectorStyles } from '../inspector/styles';
var ShowContent;
(function (ShowContent) {
    ShowContent["PanelJSON"] = "panel";
    ShowContent["DataJSON"] = "data";
    ShowContent["DataStructure"] = "structure";
})(ShowContent || (ShowContent = {}));
var options = [
    {
        label: 'Panel JSON',
        description: 'The model saved in the dashboard JSON that configures how everything works.',
        value: ShowContent.PanelJSON,
    },
    {
        label: 'Data',
        description: 'The raw model passed to the panel visualization',
        value: ShowContent.DataJSON,
    },
    {
        label: 'DataFrame structure',
        description: 'Response info without any values',
        value: ShowContent.DataStructure,
    },
];
var InspectJSONTab = /** @class */ (function (_super) {
    __extends(InspectJSONTab, _super);
    function InspectJSONTab(props) {
        var _this = _super.call(this, props) || this;
        _this.onSelectChanged = function (item) {
            var show = _this.getJSONObject(item.value);
            var text = getPrettyJSON(show);
            _this.setState({ text: text, show: item.value });
        };
        // Called onBlur
        _this.onTextChanged = function (text) {
            _this.setState({ text: text });
        };
        _this.onApplyPanelModel = function () {
            var _a = _this.props, panel = _a.panel, dashboard = _a.dashboard, onClose = _a.onClose;
            if (_this.hasPanelJSON) {
                try {
                    if (!dashboard.meta.canEdit) {
                        appEvents.emit(AppEvents.alertError, ['Unable to apply']);
                    }
                    else {
                        var updates = JSON.parse(_this.state.text);
                        dashboard.shouldUpdateDashboardPanelFromJSON(updates, panel);
                        panel.restoreModel(updates);
                        panel.refresh();
                        appEvents.emit(AppEvents.alertSuccess, ['Panel model updated']);
                    }
                }
                catch (err) {
                    console.error('Error applying updates', err);
                    appEvents.emit(AppEvents.alertError, ['Invalid JSON text']);
                }
                onClose();
            }
        };
        _this.hasPanelJSON = !!(props.panel && props.dashboard);
        // If we are in panel, we want to show PanelJSON, otherwise show DataJSON
        _this.state = {
            show: _this.hasPanelJSON ? ShowContent.PanelJSON : ShowContent.DataJSON,
            text: _this.hasPanelJSON ? getPrettyJSON(props.panel.getSaveModel()) : getPrettyJSON(props.data),
        };
        return _this;
    }
    InspectJSONTab.prototype.getJSONObject = function (show) {
        var _a = this.props, data = _a.data, panel = _a.panel;
        if (show === ShowContent.DataJSON) {
            return data;
        }
        if (show === ShowContent.DataStructure) {
            var series = data === null || data === void 0 ? void 0 : data.series;
            if (!series) {
                return { note: 'Missing Response Data' };
            }
            return data.series.map(function (frame) {
                var _a = frame, table = _a.table, fields = _a.fields, rest = __rest(_a, ["table", "fields"]); // remove 'table' from arrow response
                return __assign(__assign({}, rest), { fields: frame.fields.map(function (field) {
                        return chain(field).omit('values').omit('state').omit('display').value();
                    }) });
            });
        }
        if (this.hasPanelJSON && show === ShowContent.PanelJSON) {
            return panel.getSaveModel();
        }
        return { note: "Unknown Object: " + show };
    };
    InspectJSONTab.prototype.render = function () {
        var _this = this;
        var dashboard = this.props.dashboard;
        var _a = this.state, show = _a.show, text = _a.text;
        var jsonOptions = this.hasPanelJSON ? options : options.slice(1, options.length);
        var selected = options.find(function (v) { return v.value === show; });
        var isPanelJSON = show === ShowContent.PanelJSON;
        var canEdit = dashboard && dashboard.meta.canEdit;
        var styles = getPanelInspectorStyles();
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.toolbar, "aria-label": selectors.components.PanelInspector.Json.content },
                React.createElement(Field, { label: "Select source", className: "flex-grow-1" },
                    React.createElement(Select, { menuShouldPortal: true, options: jsonOptions, value: selected, onChange: this.onSelectChanged })),
                this.hasPanelJSON && isPanelJSON && canEdit && (React.createElement(Button, { className: styles.toolbarItem, onClick: this.onApplyPanelModel }, "Apply"))),
            React.createElement("div", { className: styles.content },
                React.createElement(AutoSizer, { disableWidth: true }, function (_a) {
                    var height = _a.height;
                    return (React.createElement(CodeEditor, { width: "100%", height: height, language: "json", showLineNumbers: true, showMiniMap: (text && text.length) > 100, value: text || '', readOnly: !isPanelJSON, onBlur: _this.onTextChanged }));
                }))));
    };
    return InspectJSONTab;
}(PureComponent));
export { InspectJSONTab };
function getPrettyJSON(obj) {
    return JSON.stringify(obj, null, 2);
}
//# sourceMappingURL=InspectJSONTab.js.map