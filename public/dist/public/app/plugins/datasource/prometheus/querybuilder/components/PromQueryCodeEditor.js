import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import PromQueryField from '../../components/PromQueryField';
import { PromQueryBuilderExplained } from './PromQueryBuilderExplained';
export function PromQueryCodeEditor(props) {
    const { query, datasource, range, onRunQuery, onChange, data, app, showExplain } = props;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(PromQueryField, { datasource: datasource, query: query, range: range, onRunQuery: onRunQuery, onChange: onChange, history: [], data: data, app: app }),
        showExplain && React.createElement(PromQueryBuilderExplained, { query: query.expr })));
}
const getStyles = (theme) => {
    return {
        // This wrapper styling can be removed after the old PromQueryEditor is removed.
        // This is removing margin bottom on the old legacy inline form styles
        wrapper: css `
      .gf-form {
        margin-bottom: 0;
      }
    `,
    };
};
//# sourceMappingURL=PromQueryCodeEditor.js.map