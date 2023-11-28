import { css } from '@emotion/css';
import React from 'react';
import { RadioButtonGroup, Label, useStyles2 } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
export const AlertStateFilter = ({ onStateFilterChange, stateFilter }) => {
    const styles = useStyles2(getStyles);
    const alertStateOptions = Object.entries(AlertState)
        .sort(([labelA], [labelB]) => (labelA < labelB ? -1 : 1))
        .map(([label, state]) => ({
        label,
        value: state,
    }));
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(Label, null, "State"),
        React.createElement(RadioButtonGroup, { options: alertStateOptions, value: stateFilter, onChange: onStateFilterChange })));
};
const getStyles = (theme) => ({
    wrapper: css `
    margin-left: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=AlertStateFilter.js.map