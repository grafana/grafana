import { useState } from 'react';
import * as React from 'react';

import { PluginType } from '@grafana/data';
import { Alert } from '@grafana/ui';

type Props = {
  className?: string;
  pluginId?: string;
  pluginType?: PluginType;
  angularSupportEnabled?: boolean;
  showPluginDetailsLink?: boolean;
  interactionElementId?: string;
  children?: React.ReactNode;
};

// BMC Change: Comment below function
// function deprecationMessage(pluginType?: string, angularSupportEnabled?: boolean): string {
//   let pluginTypeString: string;
//   switch (pluginType) {
//     case PluginType.app:
//       pluginTypeString = 'app plugin';
//       break;
//     case PluginType.panel:
//       pluginTypeString = 'panel plugin';
//       break;
//     case PluginType.datasource:
//       pluginTypeString = 'data source plugin';
//       break;
//     default:
//       pluginTypeString = 'plugin';
//   }
//   let msg = `This ${pluginTypeString} uses a deprecated, legacy platform based on AngularJS and `;
//   if (angularSupportEnabled === undefined) {
//     return msg + ' may be incompatible depending on your Grafana configuration.';
//   }
//   if (angularSupportEnabled) {
//     return msg + ' will stop working in future releases of Grafana.';
//   }
//   return msg + ' is incompatible with your current Grafana configuration.';
// }

// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function AngularDeprecationPluginNotice(props: Props): React.ReactElement | null {
  const {
    className,
    // angularSupportEnabled,
    pluginId,
    // pluginType,
    // showPluginDetailsLink,
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
    // BMC Change: Next line inline
    <Alert severity="warning" title="Deprecated plugin" className={className} onRemove={() => setDismissed(true)}>
      {/* BMC Change: Next block */}
      <p>
        {/* {deprecationMessage(pluginType, angularSupportEnabled)} */}
        This plugin is deprecated and will stop working in an upcoming release.
      </p>
      <div className="markdown-html">
        {/* BMC Change Starts */}
        For more information, see the Deprecated and discontinued features topic in product documentation.
        {/* <ul>
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
              Read our deprecation notice and migration advice.
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
                View plugin details
              </a>
            </li>
          ) : null}
        </ul> */}
        {/* BMC Change Ends */}
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
