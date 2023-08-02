import { css } from '@emotion/css';
import cx from 'classnames';
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
} from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';

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

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export interface ConfigPublicDashboardForm {
  isAnnotationsEnabled: boolean;
  isTimeSelectionEnabled: boolean;
  isPaused: boolean;
}

const ConfigPublicDashboard = () => {
  const styles = useStyles2(getStyles);
  const { showModal, hideModal } = useContext(ModalsContext);
  const isDesktop = useIsDesktop();

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const hasEmailSharingEnabled =
    !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const dashboardVariables = dashboard.getVariables();
  const unsupportedDataSources = getUnsupportedDashboardDatasources(dashboard.panels);

  const { data: publicDashboard, isFetching: isGetLoading } = useGetPublicDashboardQuery(dashboard.uid);
  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();
  const disableInputs = !hasWritePermissions || isUpdateLoading || isGetLoading;

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

  return (
    <div>
      {hasWritePermissions && dashboard.hasUnsavedChanges() && <SaveDashboardChangesAlert />}
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="edit" />}
      {dashboardHasTemplateVariables(dashboardVariables) && <UnsupportedTemplateVariablesAlert />}
      {!!unsupportedDataSources.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}
      <div className={styles.titleContainer}>
        <HorizontalGroup spacing="sm" align="center">
          <h4 className={styles.title}>Settings</h4>
          {(isUpdateLoading || isGetLoading) && <Spinner size={14} />}
        </HorizontalGroup>
      </div>
      <Configuration disabled={disableInputs} onChange={onChange} register={register} />
      <hr />
      {hasEmailSharingEnabled && <EmailSharingConfiguration />}
      <Field label="Dashboard URL" className={styles.publicUrl}>
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
      <Layout
        orientation={isDesktop ? 0 : 1}
        justify={isDesktop ? 'flex-end' : 'flex-start'}
        align={isDesktop ? 'center' : 'normal'}
      >
        <HorizontalGroup spacing="sm">
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
        </HorizontalGroup>
        <HorizontalGroup justify="flex-end">
          <DeletePublicDashboardButton
            className={cx(styles.deleteButton, { [styles.deleteButtonMobile]: !isDesktop })}
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
  titleContainer: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  title: css`
    margin: 0;
  `,
  publicUrl: css`
    width: 100%;
    padding-top: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(3)};
  `,
  deleteButton: css`
    margin-left: ${theme.spacing(3)};
  `,
  deleteButtonMobile: css`
    margin-top: ${theme.spacing(2)};
  `,
});

export default ConfigPublicDashboard;
