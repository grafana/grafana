import { css } from '@emotion/css';
import React, { useContext } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { config, featureEnabled, reportInteraction } from '@grafana/runtime/src';
import {
  ClipboardButton,
  Field,
  HorizontalGroup,
  Input,
  Label,
  ModalsContext,
  Spinner,
  Switch,
  useStyles2,
  TimeRangeLabel,
} from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction, useSelector } from '../../../../../../types';
import { DeletePublicDashboardButton } from '../../../../../manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardButton';
import { isOrgAdmin } from '../../../../../plugins/admin/permissions';
import { useGetPublicDashboardQuery, useUpdatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { useIsDesktop } from '../../../../utils/screen';
import { ShareModal } from '../../ShareModal';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { SaveDashboardChangesAlert } from '../ModalAlerts/SaveDashboardChangesAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  getUnsupportedDashboardDatasources,
} from '../SharePublicDashboardUtils';

import { Configuration } from './Configuration';
import { EmailSharingConfiguration } from './EmailSharingConfiguration';
import { SettingsBar } from './SettingsBar';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export interface ConfigPublicDashboardForm {
  isAnnotationsEnabled: boolean;
  isTimeSelectionEnabled: boolean;
  isPaused: boolean;
}

const ConfigPublicDashboard = () => {
  const styles = useStyles2(getStyles);
  const isDesktop = useIsDesktop();
  const { showModal, hideModal } = useContext(ModalsContext);

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const hasEmailSharingEnabled =
    !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const dashboardVariables = dashboard.getVariables();
  const unsupportedDataSources = getUnsupportedDashboardDatasources(dashboard.panels);

  const { data: publicDashboard, isFetching: isGetLoading } = useGetPublicDashboardQuery(dashboard.uid);
  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();
  const isDataLoading = isUpdateLoading || isGetLoading;
  const disableInputs = !hasWritePermissions || isDataLoading;
  const timeRange = getTimeRange(dashboard.getDefaultTime(), dashboard);

  const { handleSubmit, setValue, register } = useForm<ConfigPublicDashboardForm>({
    defaultValues: {
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeSelectionEnabled: publicDashboard?.timeSelectionEnabled,
      isPaused: !publicDashboard?.isEnabled,
    },
  });

  const onUpdate = async (values: ConfigPublicDashboardForm) => {
    const { isAnnotationsEnabled, isTimeSelectionEnabled, isPaused } = values;

    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        annotationsEnabled: isAnnotationsEnabled,
        timeSelectionEnabled: isTimeSelectionEnabled,
        isEnabled: !isPaused,
      },
    };

    update(req);
  };

  const onChange = async (name: keyof ConfigPublicDashboardForm, value: boolean) => {
    setValue(name, value);
    await handleSubmit((data) => onUpdate(data))();
  };

  const onDismissDelete = () => {
    showModal(ShareModal, {
      dashboard,
      onDismiss: hideModal,
      activeTab: 'public-dashboard',
    });
  };

  function renderCollapsedText(styles: StylesType): React.ReactNode | undefined {
    if (isDataLoading) {
      return (
        <div className={styles.collapsed}>
          <Spinner inline={true} size={14} />
        </div>
      );
    }

    return (
      <>
        <div className={styles.collapsed}>
          Time range = <TimeRangeLabel className={styles.timeRange} value={timeRange} />
        </div>
        <div className={styles.collapsed}>{`Time range picker = ${publicDashboard?.timeSelectionEnabled}`}</div>
        <div className={styles.collapsed}>{`Annotations = ${publicDashboard?.annotationsEnabled}`}</div>
      </>
    );
  }

  return (
    <div className={styles.configContainer}>
      {hasWritePermissions && dashboard.hasUnsavedChanges() && <SaveDashboardChangesAlert />}
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="edit" />}
      {dashboardHasTemplateVariables(dashboardVariables) && <UnsupportedTemplateVariablesAlert />}
      {!!unsupportedDataSources.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}

      {hasEmailSharingEnabled && <EmailSharingConfiguration />}

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
              reportInteraction('grafana_dashboards_public_enable_clicked', {
                action: e.currentTarget.checked ? 'disable' : 'enable',
              });
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
        <SettingsBar title="Settings" headerElement={renderCollapsedText(styles)}>
          <Configuration disabled={disableInputs} onChange={onChange} register={register} timeRange={timeRange} />
        </SettingsBar>
      </Field>

      <Layout
        orientation={isDesktop ? 0 : 1}
        justify={isDesktop ? 'flex-end' : 'flex-start'}
        align={isDesktop ? 'center' : 'normal'}
      >
        <HorizontalGroup justify="flex-end">
          <DeletePublicDashboardButton
            type="button"
            disabled={disableInputs}
            data-testid={selectors.DeleteButton}
            onDismiss={onDismissDelete}
            variant="destructive"
            fill="outline"
            dashboard={dashboard}
            publicDashboard={{
              uid: publicDashboard!.uid,
              dashboardUid: dashboard.uid,
              title: dashboard.title,
            }}
          >
            Revoke public URL
          </DeletePublicDashboardButton>
        </HorizontalGroup>
      </Layout>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  configContainer: css`
    label: config container;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: ${theme.spacing(3)};
  `,
  fieldSpace: css`
    label: field space;
    width: 100%;
    margin-bottom: 0;
  `,
  collapsed: css`
    label: collapsed text;
    margin-left: ${theme.spacing.gridSize * 2}px;
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
  timeRange: css({
    display: 'inline-block',
  }),
  settingsContainer: css`
    label: Settings;
    padding: ${theme.spacing(0.5, 0.5)};
    border-radius: ${theme.shape.borderRadius(1)};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: grid;
    grid-template-columns: minmax(100px, max-content) min-content;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;

    &:focus {
      outline: none;
    }
  `,
});
type StylesType = ReturnType<typeof getStyles>;

export default ConfigPublicDashboard;
