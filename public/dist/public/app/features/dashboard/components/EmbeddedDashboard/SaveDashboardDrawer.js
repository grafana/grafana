import React, { useMemo, useState } from 'react';
import { config } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import DashboardValidation from '../SaveDashboard/DashboardValidation';
import { SaveDashboardDiff } from '../SaveDashboard/SaveDashboardDiff';
import { jsonDiff } from '../VersionHistory/utils';
import { SaveDashboardForm } from './SaveDashboardForm';
export const SaveDashboardDrawer = ({ dashboard, onDismiss, dashboardJson, onSave }) => {
    const data = useMemo(() => {
        const clone = dashboard.getSaveModelClone();
        const diff = jsonDiff(JSON.parse(JSON.stringify(dashboardJson, null, 2)), clone);
        let diffCount = 0;
        for (const d of Object.values(diff)) {
            diffCount += d.length;
        }
        return {
            clone,
            diff,
            diffCount,
            hasChanges: diffCount > 0,
        };
    }, [dashboard, dashboardJson]);
    const [showDiff, setShowDiff] = useState(false);
    return (React.createElement(Drawer, { title: 'Save dashboard', onClose: onDismiss, subtitle: dashboard.title, tabs: React.createElement(TabsBar, null,
            React.createElement(Tab, { label: 'Details', active: !showDiff, onChangeTab: () => setShowDiff(false) }),
            data.hasChanges && (React.createElement(Tab, { label: 'Changes', active: showDiff, onChangeTab: () => setShowDiff(true), counter: data.diffCount }))) },
        showDiff ? (React.createElement(SaveDashboardDiff, { diff: data.diff, oldValue: dashboardJson, newValue: data.clone })) : (React.createElement(SaveDashboardForm, { dashboard: dashboard, saveModel: data, onCancel: onDismiss, onSuccess: onDismiss, onSubmit: onSave })),
        config.featureToggles.showDashboardValidationWarnings && React.createElement(DashboardValidation, { dashboard: dashboard })));
};
//# sourceMappingURL=SaveDashboardDrawer.js.map