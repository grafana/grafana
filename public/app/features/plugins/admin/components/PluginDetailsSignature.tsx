import React from 'react';

import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

// Designed to show signature information inside the active tab on the plugin's details page
export function PluginDetailsSignature({ className, plugin }: Props): React.ReactElement | null {
  const isSignatureValid = plugin.signature === PluginSignatureStatus.valid;
  const isCore = plugin.signature === PluginSignatureStatus.internal;
  const isDisabled = plugin.isDisabled && isDisabledDueTooSignatureError(plugin.error);

  // The basic information is already available in the header
  if (isSignatureValid || isCore || isDisabled) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title="Invalid plugin signature"
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

function isDisabledDueTooSignatureError(error: PluginErrorCode | undefined) {
  // If the plugin is disabled due to signature error we rely on the disabled
  // error message instad of the warning about the signature.

  switch (error) {
    case PluginErrorCode.invalidSignature:
    case PluginErrorCode.missingSignature:
    case PluginErrorCode.modifiedSignature:
      return true;

    default:
      return false;
  }
}
