import { css } from '@emotion/css';
import cx from 'classnames';
import React, { useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';

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
import { AccessControlAction } from '../../../../../../types';
import { DeletePublicDashboardButton } from '../../../../../manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardButton';
import { isOrgAdmin } from '../../../../../plugins/admin/permissions';
import { useUpdatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { DashboardModel } from '../../../../state';
import { useIsDesktop } from '../../../../utils/screen';
import { ShareModal } from '../../ShareModal';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  PublicDashboard,
} from '../SharePublicDashboardUtils';

import { Configuration } from './Configuration';

export type SharePublicDashboardInputs = {
  isAnnotationsEnabled: boolean;
  pauseShare: boolean;
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
  const isDesktop = useIsDesktop();

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const dashboardVariables = dashboard.getVariables();

  const { reset, handleSubmit, watch, register } = useForm<SharePublicDashboardInputs>({
    defaultValues: {
      isAnnotationsEnabled: false,
      isTimeRangeEnabled: false,
      pauseShare: false,
    },
  });

  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  useEffect(() => {
    reset({
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeRangeEnabled: publicDashboard?.timeSelectionEnabled,
      pauseShare: !publicDashboard?.isEnabled,
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
        isEnabled: values.pauseShare,
        annotationsEnabled: values.isAnnotationsEnabled,
        timeSelectionEnabled: values.isTimeRangeEnabled,
      },
    };

    update(req);
  };

  return (
    <form onSubmit={handleSubmit(onUpdate)}>
      <Configuration register={register} dashboard={dashboard} disabled={!hasWritePermissions || isUpdateLoading} />
      {!watch('pauseShare') && (
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
      <Layout
        orientation={isDesktop ? 0 : 1}
        justify={isDesktop ? 'flex-end' : 'flex-start'}
        align={isDesktop ? 'center' : 'normal'}
      >
        <HorizontalGroup spacing="sm">
          <Switch
            {...register('pauseShare')}
            onChange={(e) => {
              const { onChange } = register('pauseShare');
              reportInteraction('grafana_dashboards_public_enable_clicked', {
                action: e.currentTarget.checked ? 'enable' : 'disable',
              });
              onChange(e);
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
                uid: publicDashboard.uid,
                dashboardUid: dashboard.uid,
                title: dashboard.title,
              }}
            >
              Revoke public URL {/*{(isSaveLoading || isFetching) && <Spinner />}*/}
            </DeletePublicDashboardButton>
          </HorizontalGroup>
        )}
      </Layout>
    </form>
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
