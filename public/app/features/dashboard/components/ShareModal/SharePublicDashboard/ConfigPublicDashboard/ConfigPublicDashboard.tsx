import { css } from '@emotion/css';
import React, { useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { Alert, ClipboardButton, Field, HorizontalGroup, Input, ModalsContext, useStyles2 } from '@grafana/ui/src';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../../../types';
import { DeletePublicDashboardButton } from '../../../../../manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardButton';
import { isOrgAdmin } from '../../../../../plugins/admin/permissions';
import { useUpdatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { DashboardModel } from '../../../../state';
import { ShareModal } from '../../ShareModal';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  PublicDashboard,
  publicDashboardPersisted,
} from '../SharePublicDashboardUtils';

import { Configuration } from './Configuration';

export type SharePublicDashboardInputs = {
  isAnnotationsEnabled: boolean;
  enabledSwitch: boolean;
  isTimeRangeEnabled: boolean;
};

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

const ConfigPublicDashboard = ({
  dashboard,
  publicDashboard,
}: {
  dashboard: DashboardModel;
  publicDashboard: PublicDashboard;
}) => {
  const styles = useStyles2(getStyles);
  const { showModal, hideModal } = useContext(ModalsContext);

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const dashboardVariables = dashboard.getVariables();

  const { reset, handleSubmit, watch, register } = useForm<SharePublicDashboardInputs>({
    defaultValues: {
      isAnnotationsEnabled: false,
      isTimeRangeEnabled: false,
      enabledSwitch: false,
    },
  });

  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  useEffect(() => {
    reset({
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeRangeEnabled: publicDashboard?.timeSelectionEnabled,
      enabledSwitch: publicDashboard?.isEnabled,
    });
  }, [publicDashboard, reset]);

  const onDismissDelete = () => {
    showModal(ShareModal, {
      dashboard,
      onDismiss: hideModal,
      activeTab: 'share',
    });
  };

  const onUpdate = async (values: SharePublicDashboardInputs) => {
    //TODO: think about this tracking
    reportInteraction('grafana_dashboards_public_create_clicked');

    const req = {
      dashboard,
      payload: {
        ...publicDashboard!,
        isEnabled: values.enabledSwitch,
        annotationsEnabled: values.isAnnotationsEnabled,
        timeSelectionEnabled: values.isTimeRangeEnabled,
      },
    };

    update(req);
  };

  return (
    <form onSubmit={handleSubmit(onUpdate)}>
      <Configuration register={register} dashboard={dashboard} disabled={!hasWritePermissions || isUpdateLoading} />
      {publicDashboardPersisted(publicDashboard) && watch('enabledSwitch') && (
        <Field label="Link URL" className={styles.publicUrl}>
          <Input
            disabled={isUpdateLoading}
            value={generatePublicDashboardUrl(publicDashboard!)}
            readOnly
            data-testid={selectors.CopyUrlInput}
            addonAfter={
              <ClipboardButton
                data-testid={selectors.CopyUrlButton}
                variant="primary"
                icon="copy"
                getText={() => generatePublicDashboardUrl(publicDashboard!)}
              >
                Copy
              </ClipboardButton>
            }
          />
        </Field>
      )}
      {hasWritePermissions ? (
        dashboard.hasUnsavedChanges() ? (
          <Alert
            title="Please save your dashboard changes before updating the public configuration"
            severity="warning"
          />
        ) : (
          dashboardHasTemplateVariables(dashboardVariables) && (
            <Alert title="This public dashboard may not work since it uses template variables" severity="warning" />
          )
        )
      ) : (
        <Alert title="You don't have permissions to create or update a public dashboard" severity="warning" />
      )}
      <HorizontalGroup justify="flex-end">
        {publicDashboard && hasWritePermissions && (
          <DeletePublicDashboardButton
            type="button"
            disabled={isUpdateLoading}
            data-testid={selectors.DeleteButton}
            onDismiss={onDismissDelete}
            variant="destructive"
            fill="outline"
            dashboard={dashboard}
            publicDashboard={{
              uid: publicDashboard.uid,
              dashboardUid: dashboard.uid,
              title: dashboard.title,
            }}
          >
            Revoke public URL {/*{(isSaveLoading || isFetching) && <Spinner />}*/}
          </DeletePublicDashboardButton>
        )}
      </HorizontalGroup>
    </form>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  publicUrl: css`
    width: 100%;
    margin-bottom: ${theme.spacing(0, 0, 3, 0)};
  `,
});

export default ConfigPublicDashboard;
