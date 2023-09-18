import { css } from '@emotion/css';
import React from 'react';
import { FormState, UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, Form, Spinner, useStyles2 } from '@grafana/ui/src';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction, useSelector } from '../../../../../../types';
import { useCreatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import { dashboardHasTemplateVariables } from '../SharePublicDashboardUtils';
import { useGetUnsupportedDataSources } from '../useGetUnsupportedDataSources';

import { AcknowledgeCheckboxes } from './AcknowledgeCheckboxes';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export type SharePublicDashboardAcknowledgmentInputs = {
  publicAcknowledgment: boolean;
  dataSourcesAcknowledgment: boolean;
  usageAcknowledgment: boolean;
};

const CreatePublicDashboard = ({ isError }: { isError: boolean }) => {
  const styles = useStyles2(getStyles);
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;

  const { unsupportedDataSources } = useGetUnsupportedDataSources(dashboard);
  const [createPublicDashboard, { isLoading: isSaveLoading }] = useCreatePublicDashboardMutation();

  const disableInputs = !hasWritePermissions || isSaveLoading || isError;

  const onCreate = async () => {
    trackDashboardSharingActionPerType('generate_public_url', shareDashboardType.publicDashboard);
    createPublicDashboard({ dashboard, payload: { isEnabled: true } });
  };

  return (
    <div className={styles.container}>
      <div>
        <p className={styles.title}>Welcome to public dashboards public preview!</p>
        <p className={styles.description}>Currently, we don’t support template variables or frontend data sources</p>
      </div>

      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="create" />}

      {dashboardHasTemplateVariables(dashboard.getVariables()) && <UnsupportedTemplateVariablesAlert />}

      {!!unsupportedDataSources.length && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDataSources.join(', ')} />
      )}

      <Form onSubmit={onCreate} validateOn="onChange" maxWidth="none">
        {({
          register,
          formState: { isValid },
        }: {
          register: UseFormRegister<SharePublicDashboardAcknowledgmentInputs>;
          formState: FormState<SharePublicDashboardAcknowledgmentInputs>;
        }) => (
          <>
            <div className={styles.checkboxes}>
              <AcknowledgeCheckboxes disabled={disableInputs} register={register} />
            </div>
            <div className={styles.buttonContainer}>
              <Button type="submit" disabled={disableInputs || !isValid} data-testid={selectors.CreateButton}>
                Generate public URL {isSaveLoading && <Spinner className={styles.loadingSpinner} />}
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(4)};
  `,
  title: css`
    font-size: ${theme.typography.h4.fontSize};
    margin: ${theme.spacing(0, 0, 2)};
  `,
  description: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(0)};
  `,
  checkboxes: css`
    margin: ${theme.spacing(0, 0, 4)};
  `,
  buttonContainer: css`
    display: flex;
    justify-content: end;
  `,
  loadingSpinner: css`
    margin-left: ${theme.spacing(1)};
  `,
});

export default CreatePublicDashboard;
