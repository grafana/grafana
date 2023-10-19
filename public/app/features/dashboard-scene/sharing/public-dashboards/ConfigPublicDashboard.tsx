import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { useStyles2, ClipboardButton, Field, HorizontalGroup, Input, Label, Switch, Button } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { contextSrv } from 'app/core/core';
import { ConfigPublicDashboardForm } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/ConfigPublicDashboard';
import { Configuration } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/Configuration';
import { SettingsBar } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/SettingsBar';
import { SettingsSummary } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/SettingsSummary';
import { NoUpsertPermissionsAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/NoUpsertPermissionsAlert';
import { SaveDashboardChangesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/SaveDashboardChangesAlert';
import { UnsupportedDataSourcesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/UnsupportedTemplateVariablesAlert';
import { generatePublicDashboardUrl } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { useIsDesktop } from 'app/features/dashboard/utils/screen';
import { AccessControlAction } from 'app/types';

import { ShareModal } from '../ShareModal';

import { ConfirmModal } from './ConfirmModal';
import { getUnsupportedDashboardDatasources, panelTypes } from './CreatePublicDashboard';
import { SharePublicDashboardTab } from './SharePublicDashboardTab';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export function ConfigPublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const styles = useStyles2(getStyles);
  const isDesktop = useIsDesktop();

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const { dashboardRef, publicDashboard, isGetLoading, isUpdateLoading } = model.useState();
  const dashboard = dashboardRef.resolve();
  const { title: dashboardTitle, isDirty } = dashboard.useState();

  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;
  const { value: unsupportedDataSources } = useAsync(async () => {
    const types = panelTypes(dashboard);
    return getUnsupportedDashboardDatasources(types);
  }, []);

  const isDataLoading = isUpdateLoading || isGetLoading;
  const disableInputs = !hasWritePermissions || isDataLoading;
  const timeRangeState = sceneGraph.getTimeRange(model);
  const timeRange = timeRangeState.useState();

  const { handleSubmit, setValue, register } = useForm<ConfigPublicDashboardForm>({
    defaultValues: {
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeSelectionEnabled: publicDashboard?.timeSelectionEnabled,
      isPaused: !publicDashboard?.isEnabled,
    },
  });

  const onUpdate = async (values: ConfigPublicDashboardForm) => {
    const { isAnnotationsEnabled, isTimeSelectionEnabled, isPaused } = values;

    model.onUpdate({
      ...publicDashboard!,
      annotationsEnabled: isAnnotationsEnabled,
      timeSelectionEnabled: isTimeSelectionEnabled,
      isEnabled: !isPaused,
    });
  };

  const onChange = async (name: keyof ConfigPublicDashboardForm, value: boolean) => {
    setValue(name, value);
    await handleSubmit((data) => onUpdate(data))();
  };

  function onCopyURL() {
    trackDashboardSharingActionPerType('copy_public_url', shareDashboardType.publicDashboard);
  }

  return (
    <div className={styles.configContainer}>
      {hasWritePermissions && isDirty && <SaveDashboardChangesAlert />}
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="edit" />}
      {hasTemplateVariables && <UnsupportedTemplateVariablesAlert />}
      {unsupportedDataSources?.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}

      <Field label="Dashboard URL" className={styles.fieldSpace}>
        <Input
          value={generatePublicDashboardUrl(publicDashboard!.accessToken!)}
          readOnly
          disabled={!publicDashboard?.isEnabled}
          data-testid={selectors.CopyUrlInput}
          addonAfter={
            <ClipboardButton
              data-testid={selectors.CopyUrlButton}
              variant="primary"
              disabled={!publicDashboard?.isEnabled}
              getText={() => generatePublicDashboardUrl(publicDashboard!.accessToken!)}
              onClipboardCopy={onCopyURL}
            >
              Copy
            </ClipboardButton>
          }
        />
      </Field>

      <Field className={styles.fieldSpace}>
        <Layout>
          <Switch
            {...register('isPaused')}
            disabled={disableInputs}
            onChange={(e) => {
              trackDashboardSharingActionPerType(
                e.currentTarget.checked ? 'disable_sharing' : 'enable_sharing',
                shareDashboardType.publicDashboard
              );
              onChange('isPaused', e.currentTarget.checked);
            }}
            data-testid={selectors.PauseSwitch}
          />
          <Label
            className={css`
              margin-bottom: 0;
            `}
          >
            Pause sharing dashboard
          </Label>
        </Layout>
      </Field>

      <Field className={styles.fieldSpace}>
        <SettingsBar
          title="Settings"
          headerElement={({ className }) => (
            <SettingsSummary
              className={className}
              isDataLoading={isDataLoading}
              timeRange={timeRange.value}
              timeSelectionEnabled={publicDashboard?.timeSelectionEnabled}
              annotationsEnabled={publicDashboard?.annotationsEnabled}
            />
          )}
          data-testid={selectors.SettingsDropdown}
        >
          <Configuration disabled={disableInputs} onChange={onChange} register={register} timeRange={timeRange.value} />
        </SettingsBar>
      </Field>

      <Layout
        orientation={isDesktop ? 0 : 1}
        justify={isDesktop ? 'flex-end' : 'flex-start'}
        align={isDesktop ? 'center' : 'normal'}
      >
        <HorizontalGroup justify="flex-end">
          <Button
            type="button"
            disabled={disableInputs}
            data-testid={selectors.DeleteButton}
            variant="destructive"
            fill="outline"
            onClick={() => {
              dashboard.showModal(
                new ConfirmModal({
                  isOpen: true,
                  title: 'Revoke public URL',
                  icon: 'trash-alt',
                  confirmText: 'Revoke public URL',
                  body: (
                    <p className={styles.description}>
                      {dashboardTitle
                        ? 'Are you sure you want to revoke this URL? The dashboard will no longer be public.'
                        : 'Orphaned public dashboard will no longer be public.'}
                    </p>
                  ),
                  onDismiss: () => {
                    dashboard.showModal(new ShareModal({ dashboardRef, activeTab: 'Public Dashboard' }));
                  },
                  onConfirm: () => {
                    model.onDelete();
                    dashboard.closeModal();
                  },
                })
              );
            }}
          >
            Revoke public URL
          </Button>
        </HorizontalGroup>
      </Layout>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  configContainer: css({
    label: 'config container',
    display: 'flex',
    flexDirection: 'column',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
  }),
  fieldSpace: css({
    label: 'field space',
    width: '100%',
    marginBottom: 0,
  }),
  timeRange: css({
    display: 'inline-block',
  }),
  description: css({
    fontSize: theme.typography.body.fontSize,
  }),
});
