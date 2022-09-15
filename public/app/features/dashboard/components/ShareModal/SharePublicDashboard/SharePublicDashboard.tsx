import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import { Spinner } from '@grafana/ui';
import { Alert, Button, ClipboardButton, Field, Input, useStyles2 } from '@grafana/ui/src';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { useGetPubDashConfigQuery, useSavePubDashConfigMutation } from 'app/features/alerting/unified/api/pubDashApi';
import { AcknowledgeCheckboxes } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/AcknowledgeCheckboxes';
import { PubDashConfiguration } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/PubDashConfiguration';
import { PubDashDescription } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/PubDashDescription';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  publicDashboardPersisted,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types';

import { HorizontalGroup } from '../../../../../../../packages/grafana-ui/src/components/Layout/Layout';

interface Props extends ShareModalTabProps {}

interface Acknowledgements {
  publicDashboard: boolean;
  dataSources: boolean;
  usage: boolean;
}

export const SharePublicDashboard = (props: Props) => {
  const dashboardVariables = props.dashboard.getVariables();
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
  const styles = useStyles2(getStyles);

  const {
    isLoading: isFetchingLoading,
    data: publicDashboard,
    isError: isFetchingError,
  } = useGetPubDashConfigQuery(props.dashboard.uid);
  const [saveConfig, { isLoading: isSaveLoading }] = useSavePubDashConfigMutation();
  const isLoading = isFetchingLoading || isSaveLoading;

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());

  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    publicDashboard: false,
    dataSources: false,
    usage: false,
  });

  useEffect(() => {
    reportInteraction('grafana_dashboards_public_share_viewed');
  }, []);

  useEffect(() => {
    if (publicDashboardPersisted(publicDashboard)) {
      setAcknowledgements({
        publicDashboard: true,
        dataSources: true,
        usage: true,
      });
    }
  }, [publicDashboard]);

  const onSavePublicConfig = () => {
    reportInteraction('grafana_dashboards_public_create_clicked');

    if (dashboardHasTemplateVariables(dashboardVariables)) {
      dispatch(
        notifyApp(createErrorNotification('This dashboard cannot be made public because it has template variables'))
      );
      return;
    }

    saveConfig(props.dashboard.uid);
    // savePublicDashboardConfig(props.dashboard.uid, publicDashboard, setPublicDashboardConfig).catch();
  };

  const onAcknowledge = useCallback(
    (field: string, checked: boolean) => {
      setAcknowledgements({ ...acknowledgements, [field]: checked });
    },
    [acknowledgements]
  );

  const acknowledged = acknowledgements.publicDashboard && acknowledgements.dataSources && acknowledgements.usage;

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
        {isFetchingLoading && <Spinner />}
      </HorizontalGroup>
      <div className={styles.content}>
        {dashboardHasTemplateVariables(dashboardVariables) ? (
          <Alert
            severity="warning"
            title="dashboard cannot be public"
            data-testid={selectors.TemplateVariablesWarningAlert}
          >
            This dashboard cannot be made public because it has template variables
          </Alert>
        ) : (
          <>
            <PubDashDescription />
            <hr />
            <div className={styles.checkboxes}>
              <p>Before you click Save, please acknowledge the following information:</p>
              <AcknowledgeCheckboxes
                disabled={
                  publicDashboardPersisted(publicDashboard) || !hasWritePermissions || isLoading || isFetchingError
                }
                acknowledgements={acknowledgements}
                onAcknowledge={onAcknowledge}
              />
            </div>
            <hr />
            <div>
              <h4 className="share-modal-info-text">Public dashboard configuration</h4>
              <PubDashConfiguration
                disabled={!hasWritePermissions || isLoading || isFetchingError}
                isPubDashEnabled={publicDashboard?.isEnabled}
                hasTemplateVariables={dashboardHasTemplateVariables(dashboardVariables)}
                time={{
                  from: props.dashboard.getDefaultTime().from,
                  to: props.dashboard.getDefaultTime().to,
                  timeZone: props.dashboard.timezone,
                }}
              />
              {publicDashboardPersisted(publicDashboard) && publicDashboard!.isEnabled && (
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
                props.dashboard.hasUnsavedChanges() && (
                  <Alert
                    title="Please save your dashboard changes before updating the public configuration"
                    severity="warning"
                  />
                )
              ) : (
                <Alert title="You don't have permissions to create or update a public dashboard" severity="warning" />
              )}
              <HorizontalGroup>
                <Button
                  disabled={
                    !hasWritePermissions ||
                    !acknowledged ||
                    props.dashboard.hasUnsavedChanges() ||
                    isLoading ||
                    isFetchingError
                  }
                  onClick={onSavePublicConfig}
                  data-testid={selectors.SaveConfigButton}
                >
                  Save sharing configuration
                </Button>
                {isSaveLoading && <Spinner />}
              </HorizontalGroup>
            </div>
          </>
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
