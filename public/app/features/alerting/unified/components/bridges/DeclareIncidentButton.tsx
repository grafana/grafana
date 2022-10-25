import React, { FC } from 'react';
import { useHistory } from 'react-router-dom';

import { Button } from '@grafana/ui';

import { createBridgeURL, PluginBridge, SupportedPlugin } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical';
}

export const DeclareIncident: FC<Props> = ({ title = '', severity = '' }) => {
  const history = useHistory();
  const bridgeURL = createBridgeURL(SupportedPlugin.Incident, '/incidents/declare', { title, severity });

  return (
    <PluginBridge plugin={SupportedPlugin.Incident}>
      <Button size="sm" type="button" onClick={() => history.push(bridgeURL)}>
        Declare Incident
      </Button>
    </PluginBridge>
  );
};
