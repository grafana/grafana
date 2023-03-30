import { css } from '@emotion/css';
import React from 'react';
import { FormState, UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { Button, Form, Spinner, useStyles2 } from '@grafana/ui/src';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction, useSelector } from '../../../../../../types';
import { isOrgAdmin } from '../../../../../plugins/admin/permissions';
import { useCreatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import { dashboardHasTemplateVariables, getUnsupportedDashboardDatasources } from '../SharePublicDashboardUtils';

import { AcknowledgeCheckboxes } from './AcknowledgeCheckboxes';
import { Description } from './Description';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export type SharePublicDashboardAcknowledgmentInputs = {
  publicAcknowledgment: boolean;
  dataSourcesAcknowledgment: boolean;
  usageAcknowledgment: boolean;
};

const CreatePublicDashboard = ({ isError }: { isError: boolean }) => {
  const styles = useStyles2(getStyles);
  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const unsupportedDataSources = getUnsupportedDashboardDatasources(dashboard.panels);

  const [createPublicDashboard, { isLoading: isSaveLoading }] = useCreatePublicDashboardMutation();

  const disableInputs = !hasWritePermissions || isSaveLoading || isError;

  const onCreate = async () => {
    reportInteraction('grafana_dashboards_public_create_clicked');
    createPublicDashboard({ dashboard, payload: { isEnabled: true } });
  };

  return (
    <div>
      <p className={styles.title}>Welcome to public dashboards alpha!</p>
      <Description />
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
  title: css`
    font-size: ${theme.typography.h4.fontSize};
    margin: ${theme.spacing(0, 0, 2)};
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
