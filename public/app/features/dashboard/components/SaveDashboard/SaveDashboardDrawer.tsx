import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Checkbox, CustomScrollbar, Drawer, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { SaveDashboardData, SaveDashboardModalProps } from './types';
import { GrafanaTheme2 } from '@grafana/data';
import { jsonDiff } from '../VersionHistory/utils';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';
import { backendSrv } from 'app/core/services/backend_srv';
import { useDashboardSave } from './useDashboardSave';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardForm2 } from './forms/SaveDashboardForm2';
import { SaveDashboardDiff } from './SaveDashboardDiff';

export const SaveDashboardDrawer = ({ dashboard, onDismiss }: SaveDashboardModalProps) => {
  const styles = useStyles2(getStyles);

  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariableValuesChanged(), [dashboard]);

  const [saveTimerange, setSaveTimerange] = useState(false);
  const [saveVariables, setSaveVariables] = useState(false);

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
      saveTimerange: Boolean(saveTimerange),
      saveVariables: Boolean(saveVariables),
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
  }, [dashboard, previous.value, saveTimerange, saveVariables, status.isNew]);

  const [showDiff, setShowDiff] = useState(false);
  const { state, onDashboardSave } = useDashboardSave(dashboard);

  const renderBody = () => {
    if (showDiff) {
      return <SaveDashboardDiff diff={data.diff} oldValue={previous.value} newValue={data.clone} />;
    }

    if (status.isNew) {
      return (
        <SaveDashboardAsForm
          dashboard={dashboard}
          onCancel={onDismiss}
          onSuccess={onDismiss}
          onSubmit={onDashboardSave}
          isNew={status.isNew}
        />
      );
    }

    if (status.isProvisioned) {
      return <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onDismiss} onSuccess={onDismiss} />;
    }

    return (
      <SaveDashboardForm2
        dashboard={dashboard}
        saveModel={data}
        onCancel={onDismiss}
        onSuccess={onDismiss}
        onSubmit={onDashboardSave}
        options={{
          saveTimerange,
          saveVariables,
        }}
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
      title={dashboard.title}
      onClose={onDismiss}
      width={'40%'}
      subtitle={
        <>
          {hasTimeChanged && (
            <Checkbox
              checked={saveTimerange}
              onChange={() => setSaveTimerange(!saveTimerange)}
              label="Save current time range as dashboard default"
              aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
            />
          )}
          {hasVariableChanged && (
            <Checkbox
              checked={saveVariables}
              onChange={() => setSaveVariables(!saveVariables)}
              label="Save current variable values as dashboard default"
              aria-label={selectors.pages.SaveDashboardModal.saveVariables}
            />
          )}
          <TabsBar className={styles.tabsBar}>
            <Tab label={'Save'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
            {data.hasChanges && (
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
  nothing: css`
    margin: ${theme.v1.spacing.sm};
    color: ${theme.colors.secondary.shade};
  `,
});
