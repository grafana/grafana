import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { GrafanaPlugin, PluginMeta, PluginSignatureStatus } from '@grafana/data';
import { Alert } from '@grafana/ui';

type PluginDetailsSignatureProps = {
  className?: string;
  plugin: GrafanaPlugin<PluginMeta<{}>>;
};

// Designed to show signature information inside the active tab on the plugin's details page
export function PluginDetailsSignature({ plugin, className }: PluginDetailsSignatureProps): React.ReactElement | null {
  const isSignatureValid = plugin.meta.signature === PluginSignatureStatus.valid;
  const isCore = plugin.meta.signature === PluginSignatureStatus.internal;

  // The basic information is already available in the header
  if (isSignatureValid || isCore) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title="Invlaid plugin signature"
      aria-label={selectors.pages.PluginPage.signatureInfo}
      className={className}
    >
      <p>
        Grafana Labs checks each plugin to verify that it has a valid digital signature. Plugin signature verification
        is part of our security measures to ensure plugins are safe and trustworthy. Grafana Labs can’t guarantee the
        integrity of this unsigned plugin. Ask the plugin author to request it to be signed.
      </p>

      <a
        href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
        className="external-link"
        target="_blank"
        rel="noreferrer"
      >
        Read more about plugins signing.
      </a>
    </Alert>
  );
}
