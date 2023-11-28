import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { HorizontalGroup, Icon, IconButton, Tooltip, useTheme2 } from '@grafana/ui';
import { QueryValidator } from './QueryValidator';
export function QueryToolbox(_a) {
    var { showTools, onFormatCode, onExpand, isExpanded } = _a, validatorProps = __rest(_a, ["showTools", "onFormatCode", "onExpand", "isExpanded"]);
    const theme = useTheme2();
    const [validationResult, setValidationResult] = useState();
    const styles = useMemo(() => {
        return {
            container: css `
        border: 1px solid ${theme.colors.border.medium};
        border-top: none;
        padding: ${theme.spacing(0.5, 0.5, 0.5, 0.5)};
        display: flex;
        flex-grow: 1;
        justify-content: space-between;
        font-size: ${theme.typography.bodySmall.fontSize};
      `,
            error: css `
        color: ${theme.colors.error.text};
        font-size: ${theme.typography.bodySmall.fontSize};
        font-family: ${theme.typography.fontFamilyMonospace};
      `,
            valid: css `
        color: ${theme.colors.success.text};
      `,
            info: css `
        color: ${theme.colors.text.secondary};
      `,
            hint: css `
        color: ${theme.colors.text.disabled};
        white-space: nowrap;
        cursor: help;
      `,
        };
    }, [theme]);
    let style = {};
    if (!showTools && validationResult === undefined) {
        style = { height: 0, padding: 0, visibility: 'hidden' };
    }
    return (React.createElement("div", { className: styles.container, style: style },
        React.createElement("div", null, validatorProps.onValidate && (React.createElement(QueryValidator, Object.assign({}, validatorProps, { onValidate: (result) => {
                setValidationResult(result);
                validatorProps.onValidate(result);
            } })))),
        showTools && (React.createElement("div", null,
            React.createElement(HorizontalGroup, { spacing: "sm" },
                onFormatCode && (React.createElement(IconButton, { onClick: () => {
                        var _a;
                        reportInteraction('grafana_sql_query_formatted', {
                            datasource: (_a = validatorProps.query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                        });
                        onFormatCode();
                    }, name: "brackets-curly", size: "xs", tooltip: "Format query" })),
                onExpand && (React.createElement(IconButton, { onClick: () => {
                        var _a;
                        reportInteraction('grafana_sql_editor_expand', {
                            datasource: (_a = validatorProps.query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                            expanded: !isExpanded,
                        });
                        onExpand(!isExpanded);
                    }, name: isExpanded ? 'angle-up' : 'angle-down', size: "xs", tooltip: isExpanded ? 'Collapse editor' : 'Expand editor' })),
                React.createElement(Tooltip, { content: "Hit CTRL/CMD+Return to run query" },
                    React.createElement(Icon, { className: styles.hint, name: "keyboard" })))))));
}
//# sourceMappingURL=QueryToolbox.js.map