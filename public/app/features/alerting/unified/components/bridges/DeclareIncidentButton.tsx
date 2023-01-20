import React, { FC } from 'react';

import { Button, LinkButton, Tooltip } from '@grafana/ui';

import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createBridgeURL } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical';
  url?: string;
}

export const DeclareIncident: FC<Props> = ({ title = '', severity = '', url = '' }) => {
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
