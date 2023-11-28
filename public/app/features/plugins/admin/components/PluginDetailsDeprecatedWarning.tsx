import React, { useState } from 'react';

import { renderMarkdown } from '@grafana/data';
import { Alert } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

export function PluginDetailsDeprecatedWarning(props: Props): React.ReactElement | null {
  const { className, plugin } = props;
  const [dismissed, setDismissed] = useState(false);
  const isWarningVisible = plugin.isDeprecated && !dismissed;

  return isWarningVisible ? (
    <Alert severity="warning" title="Deprecated" className={className} onRemove={() => setDismissed(true)}>
      <p>
        This {plugin.type} plugin is{' '}
        <a
          className="external-link"
          href="https://grafana.com/legal/plugin-deprecation/"
          rel="noreferrer"
          target="_blank"
        >
          deprecated
        </a>{' '}
        and has been removed from the catalog.
      </p>

      {/* Additional contextual deprecation message supporting markdown */}
      {plugin.details?.statusContext && (
        <div
          className="markdown-html"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(plugin.details.statusContext),
          }}
        />
      )}
    </Alert>
  ) : null;
}
