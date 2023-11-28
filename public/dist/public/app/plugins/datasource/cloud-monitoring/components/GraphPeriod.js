import React from 'react';
import { EditorField, EditorRow } from '@grafana/experimental';
import { HorizontalGroup, Switch } from '@grafana/ui';
import { GRAPH_PERIODS } from '../constants';
import { PeriodSelect } from './index';
export const GraphPeriod = ({ refId, onChange, graphPeriod, variableOptionGroup }) => {
    return (React.createElement(EditorRow, null,
        React.createElement(EditorField, { label: "Graph period", htmlFor: `${refId}-graph-period`, tooltip: React.createElement(React.Fragment, null,
                "Set ",
                React.createElement("code", null, "graph_period"),
                " which forces a preferred period between points. Automatically set to the current interval if left blank.") },
            React.createElement(HorizontalGroup, null,
                React.createElement(Switch, { "data-testid": `${refId}-switch-graph-period`, value: graphPeriod !== 'disabled', onChange: (e) => onChange(e.currentTarget.checked ? '' : 'disabled') }),
                React.createElement(PeriodSelect, { inputId: `${refId}-graph-period`, templateVariableOptions: variableOptionGroup.options, current: graphPeriod, onChange: onChange, disabled: graphPeriod === 'disabled', aligmentPeriods: GRAPH_PERIODS })))));
};
//# sourceMappingURL=GraphPeriod.js.map