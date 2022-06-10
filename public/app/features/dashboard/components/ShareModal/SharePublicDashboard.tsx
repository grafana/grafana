import React, { useState, useEffect, useCallback } from 'react';

import { AppEvents } from '@grafana/data';
import { Alert, Button, Checkbox, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { appEvents } from 'app/core/core';
import { VariableModel } from 'app/features/variables/types';
import { dispatch } from 'app/store/store';

import {
  getPublicDashboardConfig,
  savePublicDashboardConfig,
  PublicDashboard,
  generatePublicDashboardUrl,
  dashboardHasTemplateVariables,
  publicDashboardPersisted,
} from './SharePublicDashboardUtils';
import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {}
interface Acknowledgements {
  public: boolean;
  datasources: boolean;
  variables: boolean;
  usage: boolean;
}

export const SharePublicDashboard = (props: Props) => {
  const [publicDashboard, setPublicDashboardConfig] = useState<PublicDashboard>({
    isEnabled: false,
    uid: '',
    dashboardUid: props.dashboard.uid,
  });
  const [dashboardVariables, setDashboardVariables] = useState<VariableModel[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    public: false,
    datasources: false,
    variables: false,
    usage: false,
  });

  useEffect(() => {
    getPublicDashboardConfig(props.dashboard.uid, setPublicDashboardConfig).catch();
    setDashboardVariables(props.dashboard.getVariables());
  }, [props]);

  const onSavePublicConfig = () => {
    if (dashboardHasTemplateVariables(dashboardVariables)) {
      dispatch(
        notifyApp(createErrorNotification('This dashboard cannot be made public because it has template variables'))
      );
      return;
    }

    savePublicDashboardConfig(props.dashboard.uid, publicDashboard, setPublicDashboardConfig).catch();
  };

  const getPublicDashboardUrl = () => {
    return generatePublicDashboardUrl(publicDashboard);
  };

  const onShareUrlCopy = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  const onAcknowledge = useCallback(
    (field: string, checked: boolean) => {
      setAcknowledgements({ ...acknowledgements, [field]: checked });
      console.log(acknowledgements);
    },
    [acknowledgements]
  );

  // check if all conditions have been acknowledged
  const acknowledged = () => {
    return (
      acknowledgements.public && acknowledgements.datasources && acknowledgements.variables && acknowledgements.usage
    );
  };

  return (
    <>
      {console.log('rendered')}
      <p>Welcome to Grafana public dashboards alpha!</p>
      <p>
        To allow the current dashboard to be published publicly, toggle the switch. For now we do not support template
        variables or frontend datasources.
      </p>
      {dashboardHasTemplateVariables(dashboardVariables) && (
        <Alert severity="warning" title="dashboard cannot be public">
          This dashboard cannot be made public because it has template variables
        </Alert>
      )}
      <br />
      We&apos;d love your feedback. To share, please comment on this{' '}
      <a
        href="https://github.com/grafana/grafana/discussions/49253"
        target="_blank"
        rel="noreferrer"
        className="text-link"
      >
        github discussion
      </a>
      <hr />
      {!publicDashboardPersisted(publicDashboard) && (
        <div>
          Before you click Save, please acknowledge the following information: <br />
          <FieldSet>
            <Checkbox
              label="Your entire dashboard will be public"
              value={acknowledgements.public}
              onChange={(e) => onAcknowledge('public', e.currentTarget.checked)}
            />
            <br />
            <Checkbox
              label="Publishing currently only works with a subset of datasources"
              value={acknowledgements.datasources}
              description="learn more about supported datasources"
              onChange={(e) => onAcknowledge('datasources', e.currentTarget.checked)}
            />
            <br />
            <Checkbox
              label="Variables can be sensitive and are currently not recommended"
              value={acknowledgements.variables}
              description="learn more about template variables"
              onChange={(e) => onAcknowledge('variables', e.currentTarget.checked)}
            />
            <br />
            <Checkbox
              label="Making your dashboard public will cause queries to run each time the dashboard is viewed which may increase costs"
              value={acknowledgements.usage}
              description="learn more about query caching"
              onChange={(e) => onAcknowledge('usage', e.currentTarget.checked)}
            />
            <br />
            <br />
          </FieldSet>
        </div>
      )}
      {acknowledged() && (
        <div>
          <h4 className="share-modal-info-text">Public Dashboard Configuration</h4>
          <FieldSet>
            Time Range
            <br />
            <div style={{ padding: '5px' }}>
              <Input
                value={props.dashboard.time.from}
                disabled={true}
                addonBefore={
                  <span style={{ width: '50px', display: 'flex', alignItems: 'center', padding: '5px' }}>From:</span>
                }
              />
              <Input
                value={props.dashboard.time.to}
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
                value={publicDashboard?.isEnabled}
                onChange={() => setPublicDashboardConfig({ ...publicDashboard, isEnabled: !publicDashboard.isEnabled })}
              />
            </Field>
            {publicDashboardPersisted(publicDashboard) && (
              <Field label="Link URL">
                <Input
                  value={generatePublicDashboardUrl(publicDashboard)}
                  readOnly
                  addonAfter={
                    <ClipboardButton variant="primary" getText={getPublicDashboardUrl} onClipboardCopy={onShareUrlCopy}>
                      <Icon name="copy" /> Copy
                    </ClipboardButton>
                  }
                />
              </Field>
            )}
          </FieldSet>
          <Button onClick={onSavePublicConfig}>Save Sharing Configuration</Button>
        </div>
      )}
    </>
  );
};
