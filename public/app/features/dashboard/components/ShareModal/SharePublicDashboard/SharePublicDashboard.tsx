import { css } from '@emotion/css';
import React, { useContext, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Subscription } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import {
  Alert,
  Button,
  ClipboardButton,
  Field,
  HorizontalGroup,
  Input,
  useStyles2,
  Spinner,
  ModalsContext,
  useForceUpdate,
} from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { contextSrv } from 'app/core/services/context_srv';
import {
  useGetPublicDashboardQuery,
  useCreatePublicDashboardMutation,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { AcknowledgeCheckboxes } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/AcknowledgeCheckboxes';
import { Configuration } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/Configuration';
import { Description } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/Description';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  publicDashboardPersisted,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';
import { useIsDesktop } from 'app/features/dashboard/utils/screen';
import { DeletePublicDashboardButton } from 'app/features/manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardButton';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { AccessControlAction } from 'app/types';

import { DashboardMetaChangedEvent } from '../../../../../types/events';
import { ShareModal } from '../ShareModal';

interface Props extends ShareModalTabProps {}

type SharePublicDashboardAcknowledgmentInputs = {
  publicAcknowledgment: boolean;
  dataSourcesAcknowledgment: boolean;
  usageAcknowledgment: boolean;
};

export type SharePublicDashboardInputs = {
  isAnnotationsEnabled: boolean;
  enabledSwitch: boolean;
} & SharePublicDashboardAcknowledgmentInputs;

export const SharePublicDashboard = (props: Props) => {
  const forceUpdate = useForceUpdate();
  const styles = useStyles2(getStyles);
  const { showModal, hideModal } = useContext(ModalsContext);
  const isDesktop = useIsDesktop();

  const dashboardVariables = props.dashboard.getVariables();
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
  const { hasPublicDashboard } = props.dashboard.meta;

  const {
    isLoading: isGetLoading,
    data: publicDashboard,
    isError: isGetError,
    isFetching,
  } = useGetPublicDashboardQuery(props.dashboard.uid, {
    // if we don't have a public dashboard, don't try to load public dashboard
    skip: !hasPublicDashboard,
  });

  const {
    reset,
    handleSubmit,
    watch,
    register,
    setValue,
    getValues,
    formState: { touchedFields },
  } = useForm<SharePublicDashboardInputs>({
    defaultValues: {
      publicAcknowledgment: false,
      dataSourcesAcknowledgment: false,
      usageAcknowledgment: false,
      isAnnotationsEnabled: false,
      enabledSwitch: false,
    },
  });

  const [createPublicDashboard, { isLoading: isSaveLoading }] = useCreatePublicDashboardMutation();
  const [updatePublicDashboard, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  useEffect(() => {
    const eventSubs = new Subscription();
    eventSubs.add(props.dashboard.events.subscribe(DashboardMetaChangedEvent, forceUpdate));
    reportInteraction('grafana_dashboards_public_share_viewed');

    return () => eventSubs.unsubscribe();
  }, [props.dashboard.events, forceUpdate]);

  useEffect(() => {
    const isPublicDashboardPersisted = publicDashboardPersisted(publicDashboard);
    reset({
      publicAcknowledgment: isPublicDashboardPersisted,
      dataSourcesAcknowledgment: isPublicDashboardPersisted,
      usageAcknowledgment: isPublicDashboardPersisted,
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      enabledSwitch: publicDashboard?.isEnabled,
    });
  }, [publicDashboard, reset]);

  const isLoading = isGetLoading || isSaveLoading || isUpdateLoading;
  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const acknowledged =
    watch('publicAcknowledgment') && watch('dataSourcesAcknowledgment') && watch('usageAcknowledgment');

  const isSaveDisabled = useMemo(
    () =>
      !hasWritePermissions ||
      !acknowledged ||
      props.dashboard.hasUnsavedChanges() ||
      isLoading ||
      isFetching ||
      isGetError ||
      //CHEQUAR QUE CAMBIA. SINO USAR FORM
      (!publicDashboardPersisted(publicDashboard) && !touchedFields.enabledSwitch),
    [
      hasWritePermissions,
      acknowledged,
      props.dashboard,
      isLoading,
      isGetError,
      publicDashboard,
      isFetching,
      touchedFields.enabledSwitch,
    ]
  );

  const isDeleteDisabled = isLoading || isFetching || isGetError;

  const onSavePublicConfig = async (values: SharePublicDashboardInputs) => {
    reportInteraction('grafana_dashboards_public_create_clicked');

    const req = {
      dashboard: props.dashboard,
      payload: {
        ...publicDashboard!,
        isEnabled: values.enabledSwitch,
        annotationsEnabled: values.isAnnotationsEnabled,
      },
    };

    // create or update based on whether we have existing uid
    hasPublicDashboard ? updatePublicDashboard(req) : createPublicDashboard(req);
  };

  const onDismissDelete = () => {
    showModal(ShareModal, {
      dashboard: props.dashboard,
      onDismiss: hideModal,
      activeTab: 'share',
    });
  };

  return (
    <>
      <HorizontalGroup>
        <p
          className={css`
            margin: 0;
          `}
        >
          Welcome to Grafana public dashboards alpha!
        </p>
        {(isGetLoading || isFetching) && <Spinner />}
      </HorizontalGroup>
      <div className={styles.content}>
        {dashboardHasTemplateVariables(dashboardVariables) && !publicDashboardPersisted(publicDashboard) ? (
          <Alert
            severity="warning"
            title="dashboard cannot be public"
            data-testid={selectors.TemplateVariablesWarningAlert}
          >
            This dashboard cannot be made public because it has template variables
          </Alert>
        ) : (
          <form onSubmit={handleSubmit(onSavePublicConfig)}>
            <Description />
            <hr />
            <div className={styles.checkboxes}>
              <AcknowledgeCheckboxes
                disabled={publicDashboardPersisted(publicDashboard) || !hasWritePermissions || isLoading || isGetError}
                register={register}
              />
            </div>
            <hr />
            <Configuration
              register={register}
              dashboard={props.dashboard}
              disabled={!hasWritePermissions || isLoading || isGetError}
              onEnabledSwitchClick={() => {
                setValue('enabledSwitch', !getValues('enabledSwitch'), { shouldTouch: true });
              }}
            />
            {publicDashboardPersisted(publicDashboard) && watch('enabledSwitch') && (
              <Field label="Link URL" className={styles.publicUrl}>
                <Input
                  disabled={isLoading}
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
              props.dashboard.hasUnsavedChanges() ? (
                <Alert
                  title="Please save your dashboard changes before updating the public configuration"
                  severity="warning"
                />
              ) : (
                dashboardHasTemplateVariables(dashboardVariables) && (
                  <Alert
                    title="This public dashboard may not work since it uses template variables"
                    severity="warning"
                  />
                )
              )
            ) : (
              <Alert title="You don't have permissions to create or update a public dashboard" severity="warning" />
            )}
            <HorizontalGroup>
              <Layout orientation={isDesktop ? 0 : 1}>
                <Button type="submit" disabled={isSaveDisabled} data-testid={selectors.SaveConfigButton}>
                  {hasPublicDashboard ? 'Save public dashboard' : 'Create public dashboard'}
                </Button>
                {publicDashboard && hasWritePermissions && (
                  <DeletePublicDashboardButton
                    type="button"
                    disabled={isDeleteDisabled}
                    data-testid={selectors.DeleteButton}
                    onDismiss={onDismissDelete}
                    variant="destructive"
                    dashboard={props.dashboard}
                    publicDashboard={{
                      uid: publicDashboard.uid,
                      dashboardUid: props.dashboard.uid,
                      title: props.dashboard.title,
                    }}
                  >
                    Delete public dashboard
                  </DeletePublicDashboardButton>
                )}
              </Layout>
              {(isSaveLoading || isFetching) && <Spinner />}
            </HorizontalGroup>
          </form>
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  content: css`
    margin: ${theme.spacing(1, 0, 0, 0)};
  `,
  checkboxes: css`
    margin: ${theme.spacing(2, 0)};
  `,
  timeRange: css`
    padding: ${theme.spacing(1, 1)};
    margin: ${theme.spacing(0, 0, 2, 0)};
  `,
  publicUrl: css`
    width: 100%;
    margin-bottom: ${theme.spacing(0, 0, 3, 0)};
  `,
});
