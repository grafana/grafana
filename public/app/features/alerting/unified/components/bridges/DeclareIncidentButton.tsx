import React from 'react';

import { Button, LinkButton, Menu, Tooltip } from '@grafana/ui';

import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createBridgeURL } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical' | '';
  url?: string;
}

export const DeclareIncidentButton = ({ title = '', severity = '', url = '' }: Props) => {
  const bridgeURL = createBridgeURL(SupportedPlugin.Incident, '/incidents/declare', { title, severity, url });

  const { loading, installed, settings } = usePluginBridge(SupportedPlugin.Incident);

  return (
    <>
      {loading === true && (
        <Button icon="fire" size="sm" type="button" disabled>
          Declare Incident
        </Button>
      )}
      {installed === false && (
        <Tooltip content={'Grafana Incident is not installed or is not configured correctly'}>
          <Button icon="fire" size="sm" type="button" disabled>
            Declare Incident
          </Button>
        </Tooltip>
      )}
      {settings && (
        <LinkButton icon="fire" size="sm" type="button" href={bridgeURL}>
          Declare Incident
        </LinkButton>
      )}
    </>
  );
};

export const DeclareIncidentMenuItem = ({ title = '', severity = '', url = '' }: Props) => {
  const bridgeURL = createBridgeURL(SupportedPlugin.Incident, '/incidents/declare', { title, severity, url });

  const { loading, installed, settings } = usePluginBridge(SupportedPlugin.Incident);

  return (
    <>
      {loading === true && <Menu.Item label="Declare incident" icon="fire" disabled />}
      {installed === false && (
        <Tooltip content={'Grafana Incident is not installed or is not configured correctly'}>
          <Menu.Item label="Declare incident" icon="fire" disabled />
        </Tooltip>
      )}
      {settings && <Menu.Item label="Declare incident" url={bridgeURL} icon="fire" />}
    </>
  );
};
