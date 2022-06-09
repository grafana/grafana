import React, { useState, useEffect, useCallback } from 'react';

import { AppEvents } from '@grafana/data';
import { Alert, Button, Checkbox, ClipboardButton, Field, FieldSet, Icon, Input, Switch } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { appEvents } from 'app/core/core';
import { VariableModel } from 'app/features/variables/types';
import { dispatch } from 'app/store/store';

import {
  dashboardHasTemplateVariables,
  getPublicDashboardConfig,
  savePublicDashboardConfig,
  PublicDashboard,
  generatePublicDashboardUrl,
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
  const dashboardUid = props.dashboard.uid;
  const [publicDashboard, setPublicDashboardConfig] = useState<PublicDashboard>({
    isPublic: false,
    uid: '',
    dashboardUid,
  });
  const [dashboardVariables, setDashboardVariables] = useState<VariableModel[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    public: false,
    datasources: false,
    variables: false,
    usage: false,
  });

  useEffect(() => {
    setDashboardVariables(props.dashboard.getVariables());
    getPublicDashboardConfig(dashboardUid, setPublicDashboardConfig).catch();
    acknowledge(publicDashboard);
  }, [props, publicDashboard, dashboardUid]);

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

  // if no public dashboard exists, show acknowledgements
  const showAcknowledgements = () => {
    return publicDashboard.uid === '';
  };

  const acknowledge = (publicDashboard: PublicDashboard) => {
    if (publicDashboard.uid !== '') {
      setAcknowledgements({ public: true, datasources: true, variables: true, usage: true });
    } else {
      setAcknowledgements({ public: false, datasources: false, variables: false, usage: false });
    }
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

  const datasource_description = "to learn more <a href='google.com'>link</a>";
  return (
    <>
      Welcome to Grafana public dashboards (alpha)! To allow the current dashboard to be published publicly, toggle the
      switch. For now we do not support template variables or frontend datasources. <br />
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
      {showAcknowledgements() && (
        <div>
          Before you click Save, please acknowledge the following information: <br />
          <FieldSet>
            <Checkbox
              label="Your entire dashboard will be public"
              onChange={(e) => onAcknowledge('public', e.currentTarget.checked)}
            />{' '}
            <br />
            <Checkbox
              label="Publishing currently only works with a subset of datasources"
              description={datasource_description}
              onChange={(e) => onAcknowledge('datasources', e.currentTarget.checked)}
            />{' '}
            <br />
            <Checkbox
              label="Variables can be sensitive and are currently not recommended"
              description="To learn more go to: LINK"
              onChange={(e) => onAcknowledge('variables', e.currentTarget.checked)}
            />
            <br />
            <Checkbox
              label="Making your dashboard public will cause queries to run each time the dashboard is viewed which may increase costs"
              description="Learn more about _query caching_"
              onChange={(e) => onAcknowledge('usage', e.currentTarget.checked)}
            />{' '}
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
            <p style={{ padding: '5px' }}>
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
            </p>
            <Field label="Enabled" description="Configures whether current dashboard can be available publicly">
              <Switch
                disabled={dashboardHasTemplateVariables(dashboardVariables)}
                value={publicDashboard?.isPublic}
                onChange={() => setPublicDashboardConfig({ ...publicDashboard, isPublic: !publicDashboard.isPublic })}
              />
            </Field>
            {publicDashboard?.dashboardUid && (
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
