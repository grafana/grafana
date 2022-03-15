import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import {
  Button,
  Checkbox,
  CustomScrollbar,
  Drawer,
  Field,
  HorizontalGroup,
  Tab,
  TabContent,
  TabsBar,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { useForm } from 'react-hook-form';
import { SaveDashboardModalProps } from './types';
import { GrafanaTheme2 } from '@grafana/data';
import { jsonDiff } from '../VersionHistory/utils';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';
import { backendSrv } from 'app/core/services/backend_srv';
import { useDashboardSave } from './useDashboardSave';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardDiff } from './SaveDashboardDiff';

interface FormDTO {
  message?: string; // the commit message

  newDashboardTitle?: string;
}

export const SaveDashboardDrawer = ({ dashboard, onDismiss }: SaveDashboardModalProps) => {
  const styles = useStyles2(getStyles);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormDTO>({ defaultValues: {} });

  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariableValuesChanged(), [dashboard]);

  const [saveTimeRange, setSaveTimeRange] = useState(false);
  const [saveVariables, setSaveVariables] = useState(false);

  const status = useMemo(() => {
    const isProvisioned = dashboard.meta.provisioned;
    const isNew = dashboard.version === 0 && !dashboard.uid;
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

  const data = useMemo(() => {
    const clone = dashboard.getSaveModelClone({
      saveTimerange: Boolean(saveTimeRange),
      saveVariables: Boolean(saveVariables),
    });

    if (!previous.value) {
      return { clone };
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
  }, [dashboard, previous.value, saveTimeRange, saveVariables, status.isNew]);

  const [showDiff, setShowDiff] = useState(false);
  const [saving, setSaving] = useState(false);

  const { state, onDashboardSave } = useDashboardSave(dashboard);
  const doSave = async (dto: FormDTO) => {
    setSaving(true);

    const body = data.clone;
    if (status.isNew && dto.newDashboardTitle) {
      body.title = dto.newDashboardTitle;
    }

    const result = await onDashboardSave(
      body,
      {
        message: dto.message,
        saveTimerange: saveTimeRange,
        saveVariables: saveVariables,
      },
      dashboard
    );

    if (result.status === 'success') {
      if (saveVariables) {
        dashboard.resetOriginalVariables();
      }
      if (saveTimeRange) {
        dashboard.resetOriginalTime();
      }
    }
    onDismiss();
    setSaving(false);
  };

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
          onSubmit={(clone, options, dashboard) => {
            return onDashboardSave(clone, options, dashboard);
          }}
          isNew={status.isNew}
          leftButtons={true}
        />
      );
    }

    if (status.isProvisioned) {
      return <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onDismiss} onSuccess={onDismiss} />;
    }

    return (
      <form onSubmit={handleSubmit(doSave)}>
        <Field label="Message" invalid={!!errors.message} error="Message is required">
          <TextArea
            {...register('message', { required: false })}
            rows={5}
            placeholder="Add a note to describe your changes."
            autoFocus
          />
        </Field>

        <HorizontalGroup>
          <Button type="button" variant="secondary" onClick={onDismiss} fill="outline">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!data.hasChanges}
            icon={saving ? 'fa fa-spinner' : undefined}
            aria-label={selectors.pages.SaveDashboardModal.save}
          >
            {saving ? '' : 'Save'}
          </Button>
        </HorizontalGroup>
        {!data.hasChanges && <div className={styles.nothing}>No changes to save</div>}
      </form>
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
              checked={saveTimeRange}
              onChange={() => setSaveTimeRange(!saveTimeRange)}
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
