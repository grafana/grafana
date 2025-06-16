import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';

import DashboardValidation from './DashboardValidation';
import { SaveDashboardDiff } from './SaveDashboardDiff';
import { proxyHandlesError, SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardData, SaveDashboardModalProps, SaveDashboardOptions } from './types';
import { useDashboardSave } from './useDashboardSave';

export const SaveDashboardDrawer = ({ dashboard, onDismiss, onSaveSuccess, isCopy }: SaveDashboardModalProps) => {
  const [options, setOptions] = useState<SaveDashboardOptions>({});
  const previous = dashboard.getOriginalDashboard();
  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.version === 0;
  const hasUnsavedFolderChange = Boolean(dashboard.meta.hasUnsavedFolderChange);
  const [errorIsHandled, setErrorIsHandled] = useState(false);

  const data = useMemo<SaveDashboardData>(() => {
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
      hasChanges: (diffCount > 0 || hasUnsavedFolderChange) && !isNew,
    };
  }, [dashboard, previous, options, isNew, hasUnsavedFolderChange]);

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
      return <SaveDashboardDiff diff={data.diff} oldValue={previous} newValue={data.clone} />;
    }

    if (isNew || isCopy) {
      return (
        <SaveDashboardAsForm
          dashboard={dashboard}
          isLoading={state.loading}
          onCancel={onDismiss}
          onSuccess={onSuccess}
          onSubmit={onDashboardSave}
          isNew={isNew}
        />
      );
    }

    if (isProvisioned) {
      return <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onDismiss} onSuccess={onSuccess} />;
    }

    return (
      <SaveDashboardForm
        dashboard={dashboard}
        isLoading={state.loading}
        saveModel={data}
        onCancel={onDismiss}
        onSuccess={onSuccess}
        onSubmit={onDashboardSave}
        options={options}
        onOptionsChange={setOptions}
      />
    );
  };

  if (state.error && !errorIsHandled && isFetchError(state.error) && proxyHandlesError(state.error.data.status)) {
    return (
      <SaveDashboardErrorProxy
        error={state.error}
        dashboard={dashboard}
        dashboardSaveModel={data.clone}
        onDismiss={onDismiss}
        setErrorIsHandled={setErrorIsHandled}
      />
    );
  }

  let title = t('dashboard.save-dashboard-drawer.title', 'Save dashboard');
  if (isCopy) {
    title = t('dashboard.save-dashboard-drawer.title-copy', 'Save dashboard copy');
  } else if (isProvisioned) {
    title = t('dashboard.save-dashboard-drawer.title-provisioned', 'Provisioned dashboard');
  }

  return (
    <Drawer
      title={title}
      onClose={onDismiss}
      subtitle={dashboard.title}
      tabs={
        <TabsBar>
          <Tab
            label={t('dashboard.save-dashboard-drawer.label-details', 'Details')}
            active={!showDiff}
            onChangeTab={() => setShowDiff(false)}
          />
          {data.hasChanges && (
            <Tab
              label={t('dashboard.save-dashboard-drawer.label-changes', 'Changes')}
              active={showDiff}
              onChangeTab={() => setShowDiff(true)}
              counter={data.diffCount}
            />
          )}
        </TabsBar>
      }
    >
      {renderSaveBody()}

      {config.featureToggles.showDashboardValidationWarnings && <DashboardValidation dashboard={dashboard} />}
    </Drawer>
  );
};
