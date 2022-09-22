import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import {
  Alert,
  Button,
  Checkbox,
  ClipboardButton,
  Field,
  HorizontalGroup,
  FieldSet,
  Input,
  Label,
  LinkButton,
  Switch,
  TimeRangeInput,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { dispatch } from 'app/store/store';

import { contextSrv } from '../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../types';
import { isOrgAdmin } from '../../../plugins/admin/permissions';

import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  getPublicDashboardConfig,
  PublicDashboard,
  publicDashboardPersisted,
  savePublicDashboardConfig,
} from './SharePublicDashboardUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}

interface Acknowledgements {
  public: boolean;
  datasources: boolean;
  usage: boolean;
}

export const SharePublicDashboard = (props: Props) => {
  const dashboardVariables = props.dashboard.getVariables();
  const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
  const styles = useStyles2(getStyles);

  const hasWritePermissions = contextSrv.hasAccess(AccessControlAction.DashboardsPublicWrite, isOrgAdmin());

  const [publicDashboard, setPublicDashboardConfig] = useState<PublicDashboard>({
    isEnabled: false,
    uid: '',
    dashboardUid: props.dashboard.uid,
  });
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    public: false,
    datasources: false,
    usage: false,
  });

  const timeRange = getTimeRange(props.dashboard.getDefaultTime(), props.dashboard);

  useEffect(() => {
    reportInteraction('grafana_dashboards_public_share_viewed');

    getPublicDashboardConfig(props.dashboard.uid, setPublicDashboardConfig).catch();
  }, [props.dashboard.uid]);

  useEffect(() => {
    if (publicDashboardPersisted(publicDashboard)) {
      setAcknowledgements({
        public: true,
        datasources: true,
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

    savePublicDashboardConfig(props.dashboard, publicDashboard, setPublicDashboardConfig).catch();
  };

  const onAcknowledge = useCallback(
    (field: string, checked: boolean) => {
      setAcknowledgements({ ...acknowledgements, [field]: checked });
    },
    [acknowledgements]
  );

  // check if all conditions have been acknowledged
  const acknowledged = acknowledgements.public && acknowledgements.datasources && acknowledgements.usage;

  return (
    <>
      <p>Welcome to Grafana public dashboards alpha!</p>
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
          <p>
            To allow the current dashboard to be published publicly, toggle the switch. For now we do not support
            template variables or frontend datasources.
          </p>
          <p>
            We&apos;d love your feedback. To share, please comment on this{' '}
            <a
              href="https://github.com/grafana/grafana/discussions/49253"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              GitHub discussion
            </a>
            .
          </p>
          <hr />
          <div className={styles.checkboxes}>
            <p>Before you click Save, please acknowledge the following information:</p>
            <FieldSet disabled={publicDashboardPersisted(publicDashboard) || !hasWritePermissions}>
              <VerticalGroup spacing="md">
                <HorizontalGroup spacing="none">
                  <Checkbox
                    label="Your entire dashboard will be public"
                    value={acknowledgements.public}
                    data-testid={selectors.WillBePublicCheckbox}
                    onChange={(e) => onAcknowledge('public', e.currentTarget.checked)}
                  />
                  <LinkButton
                    variant="primary"
                    href="https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/"
                    target="_blank"
                    fill="text"
                    icon="info-circle"
                    rel="noopener noreferrer"
                    tooltip="Learn more about public dashboards"
                  />
                </HorizontalGroup>
                <HorizontalGroup spacing="none">
                  <Checkbox
                    label="Publishing currently only works with a subset of datasources"
                    value={acknowledgements.datasources}
                    data-testid={selectors.LimitedDSCheckbox}
                    onChange={(e) => onAcknowledge('datasources', e.currentTarget.checked)}
                  />
                  <LinkButton
                    variant="primary"
                    href="https://grafana.com/docs/grafana/latest/datasources/"
                    target="_blank"
                    fill="text"
                    icon="info-circle"
                    rel="noopener noreferrer"
                    tooltip="Learn more about public datasources"
                  />
                </HorizontalGroup>
                <HorizontalGroup spacing="none">
                  <Checkbox
                    label="Making your dashboard public will cause queries to run each time the dashboard is viewed which may increase costs"
                    value={acknowledgements.usage}
                    data-testid={selectors.CostIncreaseCheckbox}
                    onChange={(e) => onAcknowledge('usage', e.currentTarget.checked)}
                  />
                  <LinkButton
                    variant="primary"
                    href="https://grafana.com/docs/grafana/latest/enterprise/query-caching/"
                    target="_blank"
                    fill="text"
                    icon="info-circle"
                    rel="noopener noreferrer"
                    tooltip="Learn more about query caching"
                  />
                </HorizontalGroup>
              </VerticalGroup>
            </FieldSet>
          </div>
          <hr />
          <div>
            <h4 className="share-modal-info-text">Public dashboard configuration</h4>
            <FieldSet disabled={!hasWritePermissions} className={styles.dashboardConfig}>
              <VerticalGroup spacing="md">
                <HorizontalGroup spacing="xs" justify="space-between">
                  <Label description="The public dashboard uses the default time settings of the dashboard">
                    Time Range
                  </Label>
                  <TimeRangeInput value={timeRange} disabled onChange={() => {}} />
                </HorizontalGroup>
                <HorizontalGroup spacing="xs" justify="space-between">
                  <Label description="Configures whether current dashboard can be available publicly">Enabled</Label>
                  <Switch
                    disabled={dashboardHasTemplateVariables(dashboardVariables)}
                    data-testid={selectors.EnableSwitch}
                    value={publicDashboard?.isEnabled}
                    onChange={() => {
                      reportInteraction('grafana_dashboards_public_enable_clicked', {
                        action: publicDashboard?.isEnabled ? 'disable' : 'enable',
                      });

                      setPublicDashboardConfig({
                        ...publicDashboard,
                        isEnabled: !publicDashboard.isEnabled,
                      });
                    }}
                  />
                </HorizontalGroup>
                {publicDashboardPersisted(publicDashboard) && publicDashboard.isEnabled && (
                  <Field label="Link URL" className={styles.publicUrl}>
                    <Input
                      value={generatePublicDashboardUrl(publicDashboard)}
                      readOnly
                      data-testid={selectors.CopyUrlInput}
                      addonAfter={
                        <ClipboardButton
                          data-testid={selectors.CopyUrlButton}
                          variant="primary"
                          icon="copy"
                          getText={() => generatePublicDashboardUrl(publicDashboard)}
                        >
                          Copy
                        </ClipboardButton>
                      }
                    />
                  </Field>
                )}
              </VerticalGroup>
            </FieldSet>
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
            <Button
              disabled={!hasWritePermissions || !acknowledged || props.dashboard.hasUnsavedChanges()}
              onClick={onSavePublicConfig}
              data-testid={selectors.SaveConfigButton}
            >
              Save sharing configuration
            </Button>
          </div>
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  checkboxes: css`
    margin: ${theme.spacing(2, 0)};
  `,
  timeRange: css`
    padding: ${theme.spacing(1, 1)};
    margin: ${theme.spacing(0, 0, 2, 0)};
  `,
  dashboardConfig: css`
    margin: ${theme.spacing(0, 0, 3, 0)};
  `,
  publicUrl: css`
    width: 100%;
    margin-bottom: 0;
  `,
});
