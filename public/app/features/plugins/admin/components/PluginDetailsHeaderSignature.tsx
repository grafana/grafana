import React from 'react';
import { PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge } from '@grafana/ui';
import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';
import { CatalogPlugin } from '../types';

type Props = {
  plugin: CatalogPlugin;
};

// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ plugin }: Props): React.ReactElement {
  const isSignatureValid = plugin.signature === PluginSignatureStatus.valid;

  return (
    <div>
      <a href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/" target="_blank" rel="noreferrer">
        <PluginSignatureBadge status={plugin.signature} />
      </a>

      {isSignatureValid && (
        <PluginSignatureDetailsBadge signatureType={plugin.signatureType} signatureOrg={plugin.signatureOrg} />
      )}
    </div>
  );
}
