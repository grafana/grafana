import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Button, HorizontalGroup, useTheme2 } from '@grafana/ui';
var getStyles = function (theme) {
    return {
        containerMargin: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(2)),
    };
};
export function SecondaryActions(props) {
    var _a, _b;
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (React.createElement("div", { className: styles.containerMargin },
        React.createElement(HorizontalGroup, null,
            !props.addQueryRowButtonHidden && (React.createElement(Button, { variant: "secondary", "aria-label": "Add row button", onClick: props.onClickAddQueryRowButton, disabled: props.addQueryRowButtonDisabled, icon: "plus" }, "Add query")),
            React.createElement(Button, { variant: "secondary", "aria-label": "Rich history button", className: cx((_a = {}, _a['explore-active-button'] = props.richHistoryButtonActive, _a)), onClick: props.onClickRichHistoryButton, icon: "history" }, "Query history"),
            React.createElement(Button, { variant: "secondary", "aria-label": "Query inspector button", className: cx((_b = {}, _b['explore-active-button'] = props.queryInspectorButtonActive, _b)), onClick: props.onClickQueryInspectorButton, icon: "info-circle" }, "Inspector"))));
}
var templateObject_1;
//# sourceMappingURL=SecondaryActions.js.map