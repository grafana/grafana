import React from 'react';
import { GrafanaPlugin, PluginMeta, PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge } from '@grafana/ui';
import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';

type Props = {
  installedPlugin?: GrafanaPlugin<PluginMeta<{}>>;
};

// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ installedPlugin }: Props): React.ReactElement | null {
  if (!installedPlugin) {
    return null;
  }

  const isSignatureValid = installedPlugin.meta.signature === PluginSignatureStatus.valid;

  return (
    <div>
      <a href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/" target="_blank" rel="noreferrer">
        <PluginSignatureBadge status={installedPlugin.meta.signature} />
      </a>

      {isSignatureValid && (
        <PluginSignatureDetailsBadge
          signatureType={installedPlugin.meta.signatureType}
          signatureOrg={installedPlugin.meta.signatureOrg}
        />
      )}
    </div>
  );
}
