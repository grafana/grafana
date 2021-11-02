import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { Icon, IconButton, useStyles } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import EmptyListCTA from '../../../core/components/EmptyListCTA/EmptyListCTA';
import { toVariableIdentifier } from '../state/types';
import { getVariableUsages } from '../inspect/utils';
import { isAdHoc } from '../guard';
import { VariableUsagesButton } from '../inspect/VariableUsagesButton';
var MoveType;
(function (MoveType) {
    MoveType[MoveType["down"] = 1] = "down";
    MoveType[MoveType["up"] = -1] = "up";
})(MoveType || (MoveType = {}));
var VariableEditorList = /** @class */ (function (_super) {
    __extends(VariableEditorList, _super);
    function VariableEditorList() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onEditClick = function (event, identifier) {
            event.preventDefault();
            _this.props.onEditClick(identifier);
        };
        _this.onChangeVariableOrder = function (event, variable, moveType) {
            event.preventDefault();
            _this.props.onChangeVariableOrder(toVariableIdentifier(variable), variable.index, variable.index + moveType);
        };
        _this.onDuplicateVariable = function (event, identifier) {
            event.preventDefault();
            _this.props.onDuplicateVariable(identifier);
        };
        _this.onRemoveVariable = function (event, identifier) {
            event.preventDefault();
            _this.props.onRemoveVariable(identifier);
        };
        return _this;
    }
    VariableEditorList.prototype.render = function () {
        var _this = this;
        return (React.createElement("div", null,
            React.createElement("div", null,
                this.props.variables.length === 0 && (React.createElement("div", null,
                    React.createElement(EmptyListCTA, { title: "There are no variables yet", buttonIcon: "calculator-alt", buttonTitle: "Add variable", infoBox: {
                            __html: " <p>\n                    Variables enable more interactive and dynamic dashboards. Instead of hard-coding things like server\n                    or sensor names in your metric queries you can use variables in their place. Variables are shown as\n                    list boxes at the top of the dashboard. These drop-down lists make it easy to change the data\n                    being displayed in your dashboard. Check out the\n                    <a class=\"external-link\" href=\"https://grafana.com/docs/grafana/latest/variables/\" target=\"_blank\">\n                      Templates and variables documentation\n                    </a>\n                    for more information.\n                  </p>",
                        }, infoBoxTitle: "What do variables do?", onClick: this.props.onAddClick }))),
                this.props.variables.length > 0 && (React.createElement("div", null,
                    React.createElement("table", { className: "filter-table filter-table--hover", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.table },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "Variable"),
                                React.createElement("th", null, "Definition"),
                                React.createElement("th", { colSpan: 6 }))),
                        React.createElement("tbody", null, this.props.variables.map(function (state, index) {
                            var variable = state;
                            var definition = variable.definition
                                ? variable.definition
                                : typeof variable.query === 'string'
                                    ? variable.query
                                    : '';
                            var usages = getVariableUsages(variable.id, _this.props.usages);
                            var passed = usages > 0 || isAdHoc(variable);
                            return (React.createElement("tr", { key: variable.name + "-" + index },
                                React.createElement("td", { style: { width: '1%' } },
                                    React.createElement("span", { onClick: function (event) { return _this.onEditClick(event, toVariableIdentifier(variable)); }, className: "pointer template-variable", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowNameFields(variable.name) }, variable.name)),
                                React.createElement("td", { style: { maxWidth: '200px' }, onClick: function (event) { return _this.onEditClick(event, toVariableIdentifier(variable)); }, className: "pointer max-width", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(variable.name) }, definition),
                                React.createElement("td", { style: { width: '1%' } },
                                    React.createElement(VariableCheckIndicator, { passed: passed })),
                                React.createElement("td", { style: { width: '1%' } },
                                    React.createElement(VariableUsagesButton, { id: variable.id, isAdhoc: isAdHoc(variable), usages: _this.props.usagesNetwork })),
                                React.createElement("td", { style: { width: '1%' } }, index > 0 && (React.createElement(IconButton, { onClick: function (event) { return _this.onChangeVariableOrder(event, variable, MoveType.up); }, name: "arrow-up", title: "Move variable up", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowArrowUpButtons(variable.name) }))),
                                React.createElement("td", { style: { width: '1%' } }, index < _this.props.variables.length - 1 && (React.createElement(IconButton, { onClick: function (event) { return _this.onChangeVariableOrder(event, variable, MoveType.down); }, name: "arrow-down", title: "Move variable down", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowArrowDownButtons(variable.name) }))),
                                React.createElement("td", { style: { width: '1%' } },
                                    React.createElement(IconButton, { onClick: function (event) { return _this.onDuplicateVariable(event, toVariableIdentifier(variable)); }, name: "copy", title: "Duplicate variable", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(variable.name) })),
                                React.createElement("td", { style: { width: '1%' } },
                                    React.createElement(IconButton, { onClick: function (event) { return _this.onRemoveVariable(event, toVariableIdentifier(variable)); }, name: "trash-alt", title: "Remove variable", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(variable.name) }))));
                        }))))))));
    };
    return VariableEditorList;
}(PureComponent));
export { VariableEditorList };
var VariableCheckIndicator = function (_a) {
    var passed = _a.passed;
    var style = useStyles(getStyles);
    if (passed) {
        return (React.createElement(Icon, { name: "check", className: style.iconPassed, title: "This variable is referenced by other variables or dashboard." }));
    }
    return (React.createElement(Icon, { name: "exclamation-triangle", className: style.iconFailed, title: "This variable is not referenced by any variable or dashboard." }));
};
var getStyles = function (theme) { return ({
    iconPassed: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.greenBase),
    iconFailed: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.orange),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=VariableEditorList.js.map