import React, { useCallback, useEffect, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { reportInteraction } from '@grafana/runtime/src';
import {
  Alert,
  Button,
  Checkbox,
  ClipboardButton,
  Field,
  FieldSet,
  Input,
  Label,
  LinkButton,
  Switch,
} from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
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

    savePublicDashboardConfig(props.dashboard.uid, publicDashboard, setPublicDashboardConfig).catch();
  };

  const onAcknowledge = useCallback(
    (field: string, checked: boolean) => {
      setAcknowledgements({ ...acknowledgements, [field]: checked });
    },
    [acknowledgements]
  );

  // check if all conditions have been acknowledged
  const acknowledged = () => {
    return acknowledgements.public && acknowledgements.datasources && acknowledgements.usage;
  };

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
          <hr />
          <div>
            Before you click Save, please acknowledge the following information: <br />
            <FieldSet disabled={publicDashboardPersisted(publicDashboard) || !hasWritePermissions}>
              <br />
              <div>
                <Checkbox
                  label="Your entire dashboard will be public"
                  value={acknowledgements.public}
                  data-testid={selectors.WillBePublicCheckbox}
                  onChange={(e) => onAcknowledge('public', e.currentTarget.checked)}
                />
              </div>
              <br />
              <div>
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
              </div>
              <br />
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
              <br />
              <br />
            </FieldSet>
          </div>
          <div>
            <h4 className="share-modal-info-text">Public Dashboard Configuration</h4>
            <FieldSet disabled={!hasWritePermissions}>
              <Label description="The public dashboard uses the default time settings of the dashboard">
                Time Range
              </Label>
              <div style={{ padding: '5px' }}>
                <Input
                  value={props.dashboard.getDefaultTime().from}
                  disabled={true}
                  addonBefore={
                    <span style={{ width: '50px', display: 'flex', alignItems: 'center', padding: '5px' }}>From:</span>
                  }
                />
                <Input
                  value={props.dashboard.getDefaultTime().to}
                  disabled={true}
                  addonBefore={
                    <span style={{ width: '50px', display: 'flex', alignItems: 'center', padding: '5px' }}>To:</span>
                  }
                />
              </div>
              <br />
              <Field label="Enabled" description="Configures whether current dashboard can be available publicly">
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
              </Field>
            </FieldSet>

            <FieldSet>
              {publicDashboardPersisted(publicDashboard) && publicDashboard.isEnabled && (
                <Field label="Link URL">
                  <Input
                    value={generatePublicDashboardUrl(publicDashboard)}
                    readOnly
                    data-testid={selectors.CopyUrlInput}
                    addonAfter={
                      <ClipboardButton
                        data-testid={selectors.CopyUrlButton}
                        variant="primary"
                        icon="copy"
                        getText={() => {
                          return generatePublicDashboardUrl(publicDashboard);
                        }}
                      >
                        Copy
                      </ClipboardButton>
                    }
                  />
                </Field>
              )}
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
              disabled={!hasWritePermissions || !acknowledged() || props.dashboard.hasUnsavedChanges()}
              onClick={onSavePublicConfig}
              data-testid={selectors.SaveConfigButton}
            >
              Save Sharing Configuration
            </Button>
          </div>
        </>
      )}
    </>
  );
};
