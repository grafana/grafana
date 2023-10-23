import { css } from '@emotion/css';
import React from 'react';
import { FormState, UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, Form, Spinner, useStyles2 } from '@grafana/ui/src';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../../../types';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';

import { AcknowledgeCheckboxes } from './AcknowledgeCheckboxes';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export type SharePublicDashboardAcknowledgmentInputs = {
  publicAcknowledgment: boolean;
  dataSourcesAcknowledgment: boolean;
  usageAcknowledgment: boolean;
};

interface CreatePublicDashboardProps {
  isError?: boolean;
  onCreate: () => void;
  unsupportedDatasources?: string[];
  unsupportedTemplateVariables?: boolean;
  isLoading?: boolean;
}
export const CreatePublicDashboard = ({
  unsupportedDatasources = [],
  isLoading = false,
  isError = false,
  unsupportedTemplateVariables = false,
  onCreate,
}: CreatePublicDashboardProps) => {
  const styles = useStyles2(getStyles);
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const disableInputs = !hasWritePermissions || isLoading || isError;

  return (
    <div className={styles.container}>
      <div>
        <p className={styles.title}>Welcome to public dashboards!</p>
        <p className={styles.description}>Currently, we don’t support template variables or frontend data sources</p>
      </div>

      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="create" />}

      {unsupportedTemplateVariables && <UnsupportedTemplateVariablesAlert />}

      {unsupportedDatasources.length > 0 && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDatasources.join(', ')} />
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
                Generate public URL {isLoading && <Spinner className={styles.loadingSpinner} />}
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
