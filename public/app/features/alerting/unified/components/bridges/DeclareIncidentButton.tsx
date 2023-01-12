import React, { FC } from 'react';
import { useHistory } from 'react-router-dom';

import { Button, Tooltip } from '@grafana/ui';

import { createBridgeURL, usePluginBridge, SupportedPlugin } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical';
}

export const DeclareIncident: FC<Props> = ({ title = '', severity = '' }) => {
  const history = useHistory();
  const bridgeURL = createBridgeURL(SupportedPlugin.Incident, '/incidents/declare', { title, severity });

  const { loading, installed, settings } = usePluginBridge(SupportedPlugin.Incident);

  return (
    <>
      {loading === true && (
        <Button size="sm" type="button" disabled>
          Declare Incident
        </Button>
      )}
      {installed === false && (
        <Tooltip content={'Grafana Incident is not installed or is not configured correctly'}>
          <Button size="sm" type="button" disabled>
            Declare Incident
          </Button>
        </Tooltip>
      )}
      {settings && (
        <Button size="sm" type="button" onClick={() => history.push(bridgeURL)}>
          Declare Incident
        </Button>
      )}
    </>
  );
};
