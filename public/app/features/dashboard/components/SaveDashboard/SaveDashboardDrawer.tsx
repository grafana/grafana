import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { config, isFetchError } from '@grafana/runtime';
import { Drawer, Spinner, Tab, TabsBar } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';

import { jsonDiff } from '../VersionHistory/utils';

import DashboardValidation from './DashboardValidation';
import { SaveDashboardDiff } from './SaveDashboardDiff';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardData, SaveDashboardModalProps, SaveDashboardOptions } from './types';
import { useDashboardSave } from './useDashboardSave';

export const SaveDashboardDrawer = ({ dashboard, onDismiss, onSaveSuccess, isCopy }: SaveDashboardModalProps) => {
  const [options, setOptions] = useState<SaveDashboardOptions>({});

  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.version === 0;

  const previous = useAsync(async () => {
    if (isNew) {
      return undefined;
    }

    const result = await backendSrv.getDashboardByUid(dashboard.uid);
    return result.dashboard;
  }, [dashboard, isNew]);

  const data = useMemo<SaveDashboardData>(() => {
    const clone = dashboard.getSaveModelClone({
      saveTimerange: Boolean(options.saveTimerange),
      saveVariables: Boolean(options.saveVariables),
    });

    if (!previous.value) {
      return { clone, diff: {}, diffCount: 0, hasChanges: false };
    }

    const cloneJSON = JSON.stringify(clone, null, 2);
    const cloneSafe = JSON.parse(cloneJSON); // avoids undefined issues

    const diff = jsonDiff(previous.value, cloneSafe);
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
  }, [dashboard, previous.value, options, isNew]);

  const [showDiff, setShowDiff] = useState(false);
  const { state, onDashboardSave } = useDashboardSave(dashboard, isCopy);
  const onSuccess = onSaveSuccess
    ? () => {
        onDismiss();
        onSaveSuccess();
      }
    : onDismiss;

  const renderSaveBody = () => {
    if (showDiff) {
      return <SaveDashboardDiff diff={data.diff} oldValue={previous.value} newValue={data.clone} />;
    }

    if (state.loading) {
      return (
        <div>
          <Spinner />
        </div>
      );
    }

    if (isNew || isCopy) {
      return (
        <SaveDashboardAsForm
          dashboard={dashboard}
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
        saveModel={data}
        onCancel={onDismiss}
        onSuccess={onSuccess}
        onSubmit={onDashboardSave}
        options={options}
        onOptionsChange={setOptions}
      />
    );
  };

  if (state.error && isFetchError(state.error) && !state.error.isHandled) {
    return (
      <SaveDashboardErrorProxy
        error={state.error}
        dashboard={dashboard}
        dashboardSaveModel={data.clone}
        onDismiss={onDismiss}
      />
    );
  }

  let title = 'Save dashboard';
  if (isCopy) {
    title = 'Save dashboard copy';
  } else if (isProvisioned) {
    title = 'Provisioned dashboard';
  }

  return (
    <Drawer
      title={title}
      onClose={onDismiss}
      width={'40%'}
      subtitle={dashboard.title}
      tabs={
        <TabsBar>
          <Tab label={'Details'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
          {data.hasChanges && (
            <Tab label={'Changes'} active={showDiff} onChangeTab={() => setShowDiff(true)} counter={data.diffCount} />
          )}
        </TabsBar>
      }
      expandable
      scrollableContent
    >
      {renderSaveBody()}

      {config.featureToggles.showDashboardValidationWarnings && <DashboardValidation dashboard={dashboard} />}
    </Drawer>
  );
};
