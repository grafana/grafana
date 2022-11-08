import React, { FC } from 'react';
import { useHistory } from 'react-router-dom';

import { createBridgeURL, PluginBridge, BridgeSupportedPlugin } from '@grafana/runtime';
import { Button, Tooltip } from '@grafana/ui';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical';
}

export const DeclareIncident: FC<Props> = ({ title = '', severity = '' }) => {
  const history = useHistory();
  const bridgeURL = createBridgeURL(BridgeSupportedPlugin.Incident, '/incidents/declare', { title, severity });

  return (
    <PluginBridge
      plugin={BridgeSupportedPlugin.Incident}
      loadingComponent={
        <Button size="sm" type="button" disabled>
          Declare Incident
        </Button>
      }
      notInstalledComponent={
        <Tooltip content={'Grafana Incident is not installed or configured incorrectly'}>
          <Button size="sm" type="button" disabled>
            Declare Incident
          </Button>
        </Tooltip>
      }
    >
      <Button size="sm" type="button" onClick={() => history.push(bridgeURL)}>
        Declare Incident
      </Button>
    </PluginBridge>
  );
};
