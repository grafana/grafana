import React, { ReactElement } from 'react';

import { PluginErrorCode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

export function PluginDetailsDisabledError({ className, plugin }: Props): ReactElement | null {
  if (!plugin.isDisabled) {
    return null;
  }

  return (
    <Alert
      severity="error"
      title="Plugin disabled"
      className={className}
      aria-label={selectors.pages.PluginPage.disabledInfo}
    >
      {renderDescriptionFromError(plugin.error)}
      <p>Please contact your server administrator to get this resolved.</p>
      <a
        href="https://grafana.com/docs/grafana/latest/administration/cli/#plugins-commands"
        className="external-link"
        target="_blank"
        rel="noreferrer"
      >
        Read more about managing plugins
      </a>
    </Alert>
  );
}

function renderDescriptionFromError(error?: PluginErrorCode): ReactElement {
  switch (error) {
    case PluginErrorCode.modifiedSignature:
      return (
        <p>
          Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
          discovered that the content of this plugin does not match its signature. We can not guarantee the trustworthy
          of this plugin and have therefore disabled it. We recommend you to reinstall the plugin to make sure you are
          running a verified version of this plugin.
        </p>
      );
    case PluginErrorCode.invalidSignature:
      return (
        <p>
          Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
          discovered that it was invalid. We can not guarantee the trustworthy of this plugin and have therefore
          disabled it. We recommend you to reinstall the plugin to make sure you are running a verified version of this
          plugin.
        </p>
      );
    case PluginErrorCode.missingSignature:
      return (
        <p>
          Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
          discovered that there is no signature for this plugin. We can not guarantee the trustworthy of this plugin and
          have therefore disabled it. We recommend you to reinstall the plugin to make sure you are running a verified
          version of this plugin.
        </p>
      );
    default:
      return (
        <p>
          We failed to run this plugin due to an unkown reason and have therefore disabled it. We recommend you to
          reinstall the plugin to make sure you are running a working version of this plugin.
        </p>
      );
  }
}
