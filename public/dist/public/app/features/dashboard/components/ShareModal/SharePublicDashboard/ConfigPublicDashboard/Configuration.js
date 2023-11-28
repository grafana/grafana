import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { FieldSet, Label, Switch, TimeRangeInput, VerticalGroup } from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
export const Configuration = ({ disabled, onChange, register, timeRange, }) => {
    return (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { disabled: disabled },
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(Layout, { orientation: 1, spacing: "xs", justify: "space-between" },
                    React.createElement(Label, { description: "The public dashboard uses the default time range settings of the dashboard" }, "Default time range"),
                    React.createElement(TimeRangeInput, { value: timeRange, disabled: true, onChange: () => { } })),
                React.createElement(Layout, { orientation: 0, spacing: "sm" },
                    React.createElement(Switch, Object.assign({}, register('isTimeSelectionEnabled'), { "data-testid": selectors.EnableTimeRangeSwitch, onChange: (e) => {
                            trackDashboardSharingActionPerType(e.currentTarget.checked ? 'enable_time' : 'disable_time', shareDashboardType.publicDashboard);
                            onChange('isTimeSelectionEnabled', e.currentTarget.checked);
                        } })),
                    React.createElement(Label, { description: "Allow viewers to change time range" }, "Time range picker enabled")),
                React.createElement(Layout, { orientation: 0, spacing: "sm" },
                    React.createElement(Switch, Object.assign({}, register('isAnnotationsEnabled'), { onChange: (e) => {
                            trackDashboardSharingActionPerType(e.currentTarget.checked ? 'enable_annotations' : 'disable_annotations', shareDashboardType.publicDashboard);
                            onChange('isAnnotationsEnabled', e.currentTarget.checked);
                        }, "data-testid": selectors.EnableAnnotationsSwitch })),
                    React.createElement(Label, { description: "Show annotations on public dashboard" }, "Show annotations"))))));
};
//# sourceMappingURL=Configuration.js.map