import { css } from '@emotion/css';
import cx from 'classnames';
import React, { useContext } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import {
  Alert,
  ClipboardButton,
  Field,
  HorizontalGroup,
  Input,
  Label,
  ModalsContext,
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
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  PublicDashboardSettings,
} from '../SharePublicDashboardUtils';

import { Configuration } from './Configuration';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

const ConfigPublicDashboard = () => {
  const styles = useStyles2(getStyles);
  const { showModal, hideModal } = useContext(ModalsContext);
  const isDesktop = useIsDesktop();

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.uid);
  const dashboardVariables = dashboard.getVariables();

  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  const onDismissDelete = () => {
    showModal(ShareModal, {
      dashboard,
      onDismiss: hideModal,
      activeTab: 'share',
    });
  };

  const onUpdate = async (name: string, value: boolean) => {
    //TODO: think about this tracking. This was being tracking when updating
    reportInteraction('grafana_dashboards_public_create_clicked');

    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        [name as keyof PublicDashboardSettings]: value,
      },
    };

    update(req);
  };

  return (
    <div>
      <Configuration disabled={!hasWritePermissions} onChange={onUpdate} />
      <Field label="Link URL" className={styles.publicUrl}>
        <Input
          value={generatePublicDashboardUrl(publicDashboard!)}
          readOnly
          disabled={!publicDashboard!.isEnabled}
          data-testid={selectors.CopyUrlInput}
          addonAfter={
            <ClipboardButton
              data-testid={selectors.CopyUrlButton}
              variant="primary"
              icon="copy"
              disabled={!publicDashboard!.isEnabled}
              getText={() => generatePublicDashboardUrl(publicDashboard!)}
            >
              Copy
            </ClipboardButton>
          }
        />
      </Field>
      {hasWritePermissions ? (
        dashboard.hasUnsavedChanges() ? (
          <Alert
            title="Please save your dashboard changes before updating the public configuration"
            severity="warning"
          />
        ) : (
          dashboardHasTemplateVariables(dashboardVariables) && <UnsupportedTemplateVariablesAlert />
        )
      ) : (
        <NoUpsertPermissionsAlert mode="edit" />
      )}
      <Layout
        orientation={isDesktop ? 0 : 1}
        justify={isDesktop ? 'flex-end' : 'flex-start'}
        align={isDesktop ? 'center' : 'normal'}
      >
        <HorizontalGroup spacing="sm">
          <Switch
            disabled={!hasWritePermissions}
            name="isEnabled"
            value={!publicDashboard!.isEnabled}
            checked={!publicDashboard!.isEnabled}
            onChange={(e) => {
              reportInteraction('grafana_dashboards_public_enable_clicked', {
                action: e.currentTarget.checked ? 'disable' : 'enable',
              });
              onUpdate(e.currentTarget.name, !e.currentTarget.checked);
            }}
            data-testid={selectors.EnableSwitch}
          />
          <Label
            className={css`
              margin-bottom: 0;
            `}
          >
            Pause sharing dashboard
          </Label>
        </HorizontalGroup>
        {hasWritePermissions && (
          <HorizontalGroup justify="flex-end">
            <DeletePublicDashboardButton
              className={cx(styles.deleteButton, { [styles.deleteButtonMobile]: !isDesktop })}
              type="button"
              disabled={isUpdateLoading}
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
        )}
      </Layout>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  publicUrl: css`
    width: 100%;
    margin-bottom: ${theme.spacing(0, 0, 3, 0)};
  `,
  deleteButton: css`
    margin-left: ${theme.spacing(3)}; ;
  `,
  deleteButtonMobile: css`
    margin-top: ${theme.spacing(2)}; ;
  `,
});

export default ConfigPublicDashboard;
