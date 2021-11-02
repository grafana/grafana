import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import { Tooltip } from '../Tooltip/Tooltip';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { useStyles2 } from '../../themes';
export function JSONViewCell(props) {
    var cell = props.cell, tableStyles = props.tableStyles, cellProps = props.cellProps;
    var txt = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    cursor: pointer;\n    font-family: monospace;\n  "], ["\n    cursor: pointer;\n    font-family: monospace;\n  "])));
    var value = cell.value;
    var displayValue = value;
    if (isString(value)) {
        try {
            value = JSON.parse(value);
        }
        catch (_a) { } // ignore errors
    }
    else {
        displayValue = JSON.stringify(value);
    }
    var content = React.createElement(JSONTooltip, { value: value });
    return (React.createElement(Tooltip, { placement: "auto-start", content: content, theme: "info-alt" },
        React.createElement("div", __assign({}, cellProps, { className: tableStyles.cellContainer }),
            React.createElement("div", { className: cx(tableStyles.cellText, txt) }, displayValue))));
}
function JSONTooltip(props) {
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", null,
            React.createElement(JSONFormatter, { json: props.value, open: 4, className: styles.json }))));
}
function getStyles(theme) {
    return {
        container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing(0.5)),
        json: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      width: fit-content;\n      max-height: 70vh;\n      overflow-y: auto;\n    "], ["\n      width: fit-content;\n      max-height: 70vh;\n      overflow-y: auto;\n    "]))),
    };
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=JSONViewCell.js.map