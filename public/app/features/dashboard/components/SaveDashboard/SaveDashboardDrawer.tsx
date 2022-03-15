import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { CustomScrollbar, Drawer, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { SaveDashboardData, SaveDashboardModalProps, SaveDashboardOptions } from './types';
import { GrafanaTheme2 } from '@grafana/data';
import { jsonDiff } from '../VersionHistory/utils';
import { useAsync } from 'react-use';
import { backendSrv } from 'app/core/services/backend_srv';
import { useDashboardSave } from './useDashboardSave';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardForm2 } from './forms/SaveDashboardForm2';
import { SaveDashboardDiff } from './SaveDashboardDiff';

export const SaveDashboardDrawer = ({ dashboard, onDismiss, onSaveSuccess, isCopy }: SaveDashboardModalProps) => {
  const styles = useStyles2(getStyles);
  const [options, setOptions] = useState<SaveDashboardOptions>({});

  const status = useMemo(() => {
    const isProvisioned = dashboard.meta.provisioned;
    const isNew = dashboard.version === 0;
    const isChanged = dashboard.version > 0;

    return {
      isProvisioned,
      isNew,
      isChanged,
    };
  }, [dashboard]);

  const previous = useAsync(async () => {
    if (status.isNew) {
      return undefined;
    }

    const result = await backendSrv.getDashboardByUid(dashboard.uid);
    return result.dashboard;
  }, [dashboard, status]);

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
      hasChanges: diffCount > 0 && !status.isNew,
    };
  }, [dashboard, previous.value, options, status.isNew]);

  const [showDiff, setShowDiff] = useState(false);
  const { state, onDashboardSave } = useDashboardSave(dashboard);
  const onSuccess = onSaveSuccess
    ? () => {
        onDismiss();
        onSaveSuccess();
      }
    : onDismiss;

  const renderBody = () => {
    if (showDiff) {
      return <SaveDashboardDiff diff={data.diff} oldValue={previous.value} newValue={data.clone} />;
    }

    if (status.isNew || isCopy) {
      return (
        <SaveDashboardAsForm
          dashboard={dashboard}
          onCancel={onDismiss}
          onSuccess={onSuccess}
          onSubmit={onDashboardSave}
          isNew={status.isNew}
        />
      );
    }

    if (status.isProvisioned) {
      return <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onDismiss} onSuccess={onSuccess} />;
    }

    return (
      <SaveDashboardForm2
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

  if (state.error) {
    return (
      <SaveDashboardErrorProxy
        error={state.error}
        dashboard={dashboard}
        dashboardSaveModel={data.clone}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <Drawer
      title={isCopy ? 'Save dashboard as...' : 'Save dashboard'}
      onClose={onDismiss}
      width={'40%'}
      subtitle={
        <>
          <TabsBar className={styles.tabsBar}>
            <Tab label={'Options'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
            {data.hasChanges && !isCopy && (
              <Tab label={'Changes'} active={showDiff} onChangeTab={() => setShowDiff(true)} counter={data.diffCount} />
            )}
          </TabsBar>
        </>
      }
      expandable
    >
      <CustomScrollbar autoHeightMin="100%">
        <TabContent>{renderBody()}</TabContent>
      </CustomScrollbar>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tabsBar: css`
    padding-left: ${theme.v1.spacing.md};
    margin: ${theme.v1.spacing.lg} -${theme.v1.spacing.sm} -${theme.v1.spacing.lg} -${theme.v1.spacing.lg};
  `,
});
