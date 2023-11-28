import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { config } from '@grafana/runtime';
import { useStyles2, HorizontalGroup, IconButton, Tooltip, Icon } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';
import { testIds } from '../../components/LokiQueryEditor';
import { LokiQueryField } from '../../components/LokiQueryField';
import { formatLogqlQuery } from '../../queryUtils';
import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';
export function LokiQueryCodeEditor({ query, datasource, range, onRunQuery, onChange, data, app, showExplain, history, }) {
    const styles = useStyles2(getStyles);
    const lokiFormatQuery = config.featureToggles.lokiFormatQuery;
    const onClickFormatQueryButton = () => __awaiter(this, void 0, void 0, function* () { return onChange(Object.assign(Object.assign({}, query), { expr: formatLogqlQuery(query.expr, datasource) })); });
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(LokiQueryField, { datasource: datasource, query: query, range: range, onRunQuery: onRunQuery, onChange: onChange, history: history, data: data, app: app, "data-testid": testIds.editor, ExtraFieldElement: React.createElement(React.Fragment, null, lokiFormatQuery && (React.createElement("div", { className: styles.buttonGroup },
                React.createElement("div", null,
                    React.createElement(HorizontalGroup, { spacing: "sm" },
                        React.createElement(IconButton, { onClick: onClickFormatQueryButton, name: "brackets-curly", size: "xs", tooltip: "Format query" }),
                        React.createElement(Tooltip, { content: `Use ${getModKey()}+z to undo` },
                            React.createElement(Icon, { className: styles.hint, name: "keyboard" }))))))) }),
        showExplain && React.createElement(LokiQueryBuilderExplained, { query: query.expr })));
}
const getStyles = (theme) => {
    return {
        wrapper: css `
      max-width: 100%;
      .gf-form {
        margin-bottom: 0.5;
      }
    `,
        buttonGroup: css `
      border: 1px solid ${theme.colors.border.medium};
      border-top: none;
      padding: ${theme.spacing(0.5, 0.5, 0.5, 0.5)};
      margin-bottom: ${theme.spacing(0.5)};
      display: flex;
      flex-grow: 1;
      justify-content: end;
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
        hint: css `
      color: ${theme.colors.text.disabled};
      white-space: nowrap;
      cursor: help;
    `,
    };
};
//# sourceMappingURL=LokiQueryCodeEditor.js.map