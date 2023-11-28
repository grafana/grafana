import { css } from '@emotion/css';
import React from 'react';
import { Components } from '@grafana/e2e-selectors';
import { ToolbarButton, useTheme2 } from '@grafana/ui';
const getStyles = (theme) => {
    return {
        containerMargin: css `
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.spacing(1)};
      margin-top: ${theme.spacing(2)};
    `,
    };
};
export function SecondaryActions(props) {
    const theme = useTheme2();
    const styles = getStyles(theme);
    return (React.createElement("div", { className: styles.containerMargin },
        !props.addQueryRowButtonHidden && (React.createElement(ToolbarButton, { variant: "canvas", "aria-label": "Add query", onClick: props.onClickAddQueryRowButton, disabled: props.addQueryRowButtonDisabled, icon: "plus" }, "Add query")),
        !props.richHistoryRowButtonHidden && (React.createElement(ToolbarButton, { variant: props.richHistoryButtonActive ? 'active' : 'canvas', "aria-label": "Query history", onClick: props.onClickRichHistoryButton, "data-testid": Components.QueryTab.queryHistoryButton, icon: "history" }, "Query history")),
        React.createElement(ToolbarButton, { variant: props.queryInspectorButtonActive ? 'active' : 'canvas', "aria-label": "Query inspector", onClick: props.onClickQueryInspectorButton, icon: "info-circle" }, "Query inspector")));
}
//# sourceMappingURL=SecondaryActions.js.map