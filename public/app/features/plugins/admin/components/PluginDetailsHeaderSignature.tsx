import React from 'react';
import { GrafanaPlugin, PluginMeta, PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge } from '@grafana/ui';
import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';

type Props = {
  className?: string;
  plugin: GrafanaPlugin<PluginMeta<{}>>;
};

// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ plugin, className }: Props): React.ReactElement | null {
  const isSignatureValid = plugin.meta.signature === PluginSignatureStatus.valid;

  return (
    <div>
      <a href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/" target="_blank" rel="noreferrer">
        <PluginSignatureBadge status={plugin.meta.signature} />
      </a>

      {isSignatureValid && (
        <PluginSignatureDetailsBadge
          signatureType={plugin.meta.signatureType}
          signatureOrg={plugin.meta.signatureOrg}
        />
      )}
    </div>
  );
}
