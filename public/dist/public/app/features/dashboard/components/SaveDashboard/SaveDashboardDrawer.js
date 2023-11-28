import React, { useMemo, useState } from 'react';
import { config, isFetchError } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { jsonDiff } from '../VersionHistory/utils';
import DashboardValidation from './DashboardValidation';
import { SaveDashboardDiff } from './SaveDashboardDiff';
import { proxyHandlesError, SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { useDashboardSave } from './useDashboardSave';
export const SaveDashboardDrawer = ({ dashboard, onDismiss, onSaveSuccess, isCopy }) => {
    const [options, setOptions] = useState({});
    const previous = dashboard.getOriginalDashboard();
    const isProvisioned = dashboard.meta.provisioned;
    const isNew = dashboard.version === 0;
    const data = useMemo(() => {
        const clone = dashboard.getSaveModelClone({
            saveTimerange: Boolean(options.saveTimerange),
            saveVariables: Boolean(options.saveVariables),
        });
        if (!previous) {
            return { clone, diff: {}, diffCount: 0, hasChanges: false };
        }
        const diff = jsonDiff(previous, clone);
        let diffCount = 0;
        for (const d of Object.values(diff)) {
            diffCount += d.length;
        }
        return {
            clone,
            diff,
            diffCount,
            hasChanges: diffCount > 0 && !isNew,
        };
    }, [dashboard, previous, options, isNew]);
    const [showDiff, setShowDiff] = useState(false);
    const { state, onDashboardSave } = useDashboardSave(isCopy);
    const onSuccess = onSaveSuccess
        ? () => {
            onDismiss();
            onSaveSuccess();
        }
        : onDismiss;
    const renderSaveBody = () => {
        if (showDiff) {
            return React.createElement(SaveDashboardDiff, { diff: data.diff, oldValue: previous, newValue: data.clone });
        }
        if (isNew || isCopy) {
            return (React.createElement(SaveDashboardAsForm, { dashboard: dashboard, isLoading: state.loading, onCancel: onDismiss, onSuccess: onSuccess, onSubmit: onDashboardSave, isNew: isNew }));
        }
        if (isProvisioned) {
            return React.createElement(SaveProvisionedDashboardForm, { dashboard: dashboard, onCancel: onDismiss, onSuccess: onSuccess });
        }
        return (React.createElement(SaveDashboardForm, { dashboard: dashboard, isLoading: state.loading, saveModel: data, onCancel: onDismiss, onSuccess: onSuccess, onSubmit: onDashboardSave, options: options, onOptionsChange: setOptions }));
    };
    if (state.error &&
        isFetchError(state.error) &&
        !state.error.isHandled &&
        proxyHandlesError(state.error.data.status)) {
        return (React.createElement(SaveDashboardErrorProxy, { error: state.error, dashboard: dashboard, dashboardSaveModel: data.clone, onDismiss: onDismiss }));
    }
    let title = 'Save dashboard';
    if (isCopy) {
        title = 'Save dashboard copy';
    }
    else if (isProvisioned) {
        title = 'Provisioned dashboard';
    }
    return (React.createElement(Drawer, { title: title, onClose: onDismiss, subtitle: dashboard.title, tabs: React.createElement(TabsBar, null,
            React.createElement(Tab, { label: 'Details', active: !showDiff, onChangeTab: () => setShowDiff(false) }),
            data.hasChanges && (React.createElement(Tab, { label: 'Changes', active: showDiff, onChangeTab: () => setShowDiff(true), counter: data.diffCount }))) },
        renderSaveBody(),
        config.featureToggles.showDashboardValidationWarnings && React.createElement(DashboardValidation, { dashboard: dashboard })));
};
//# sourceMappingURL=SaveDashboardDrawer.js.map