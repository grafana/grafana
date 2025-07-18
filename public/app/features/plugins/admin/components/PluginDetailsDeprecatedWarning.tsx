import { useState } from 'react';
import * as React from 'react';

import { renderMarkdown } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';

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
    <Alert
      severity="warning"
      title={t('plugins.plugin-details-deprecated-warning.title-deprecated', 'Deprecated')}
      className={className}
      onRemove={() => setDismissed(true)}
    >
      <p>
        <Trans i18nKey="plugin.plugin-details-deprecated-warning.body-deprecated" values={{ pluginType: plugin.type }}>
          This {'{{pluginType}}'} plugin is{' '}
          <TextLink href="https://grafana.com/legal/plugin-deprecation/" external>
            deprecated
          </TextLink>{' '}
          and has been removed from the catalog.
        </Trans>
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
