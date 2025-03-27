import { useState } from 'react';
import * as React from 'react';

import { PluginType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

type Props = {
  className?: string;
  pluginId?: string;
  pluginType?: PluginType;
  angularSupportEnabled?: boolean;
  showPluginDetailsLink?: boolean;
  interactionElementId?: string;
  children?: React.ReactNode;
};

function deprecationMessage(pluginType?: string, angularSupportEnabled?: boolean): string {
  let pluginTypeString: string;
  switch (pluginType) {
    case PluginType.app:
      pluginTypeString = 'app plugin';
      break;
    case PluginType.panel:
      pluginTypeString = 'panel plugin';
      break;
    case PluginType.datasource:
      pluginTypeString = 'data source plugin';
      break;
    default:
      pluginTypeString = 'plugin';
  }
  let msg = `This ${pluginTypeString} uses a deprecated, legacy platform based on AngularJS and `;
  if (angularSupportEnabled === undefined) {
    return msg + ' may be incompatible depending on your Grafana configuration.';
  }
  if (angularSupportEnabled) {
    return msg + ' will stop working in future releases of Grafana.';
  }
  return msg + ' is incompatible with your current Grafana configuration.';
}

// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function AngularDeprecationPluginNotice(props: Props): React.ReactElement | null {
  const {
    className,
    angularSupportEnabled,
    pluginId,
    pluginType,
    showPluginDetailsLink,
    interactionElementId,
    children,
  } = props;
  const [dismissed, setDismissed] = useState(false);

  const interactionAttributes: Record<string, string> = {};
  if (pluginId) {
    interactionAttributes.pluginId = pluginId;
  }
  if (interactionElementId) {
    interactionAttributes.elementId = interactionElementId;
  }

  return dismissed ? null : (
    <Alert
      severity="warning"
      title={t('plugins.angular-deprecation-plugin-notice.title-angular-plugin', 'Angular plugin')}
      className={className}
      onRemove={() => setDismissed(true)}
    >
      <p>{deprecationMessage(pluginType, angularSupportEnabled)}</p>
      <div className="markdown-html">
        <ul>
          <li>
            <a
              href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
              className="external-link"
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                reportInteraction('angular_deprecation_docs_clicked', interactionAttributes);
              }}
            >
              <Trans i18nKey="plugins.angular-deprecation-plugin-notice.deprecation-notice-migration-advice">
                Read our deprecation notice and migration advice.
              </Trans>
            </a>
          </li>
          {showPluginDetailsLink && pluginId ? (
            <li>
              <a
                href={`plugins/${encodeURIComponent(pluginId)}`}
                className="external-link"
                target="_blank"
                rel="noreferrer"
              >
                <Trans i18nKey="plugins.angular-deprecation-plugin-notice.view-plugin-details">
                  View plugin details
                </Trans>
              </a>
            </li>
          ) : null}
        </ul>
      </div>
      {children && (
        <>
          <hr />
          {children}
        </>
      )}
    </Alert>
  );
}
