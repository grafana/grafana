import * as React from 'react';

import { PluginErrorBoundary } from '../components/PluginErrorBoundary';

import { ExtensionErrorAlert } from './ExtensionErrorAlert';
import { ExtensionsLog, log as baseLog } from './logs/log';
import { isGrafanaDevMode } from './utils';

export const ExtensionErrorBoundary = ({
  children,
  pluginId,
  extensionTitle,
  log = baseLog,
  fallbackAlwaysVisible = false,
}: {
  children: React.ReactNode;
  pluginId: string;
  extensionTitle: string;
  log?: ExtensionsLog;
  fallbackAlwaysVisible?: boolean;
}) => {
  return (
    <PluginErrorBoundary
      onError={(error, errorInfo) => {
        log.error(`Extension "${pluginId}/${extensionTitle}" failed to load.`, {
          message: error.message,
          componentStack: errorInfo.componentStack ?? '',
          digest: errorInfo.digest ?? '',
        });
      }}
      fallback={() => {
        if (isGrafanaDevMode() || fallbackAlwaysVisible) {
          return <ExtensionErrorAlert pluginId={pluginId} extensionTitle={extensionTitle} />;
        }

        return null;
      }}
    >
      {children}
    </PluginErrorBoundary>
  );
};
