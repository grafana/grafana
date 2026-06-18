import { type ReactElement } from 'react';

import { type PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

import { AlertingRuleExtensionPointMenu } from './AlertingRuleExtensionPointMenu';

interface AlertInstanceExtensionPointProps {
  rule?: CombinedRule;
  instance: Alert;
  extensionPointId: PluginExtensionPoints;
}

export function AlertInstanceExtensionPoint({
  rule,
  instance,
  extensionPointId,
}: AlertInstanceExtensionPointProps): ReactElement | null {
  const { links } = usePluginLinks({
    extensionPointId,
    context: {
      rule,
      instance,
    },
  });

  if (links.length === 0) {
    return null;
  }

  return (
    <Dropdown
      overlay={
        <AlertingRuleExtensionPointMenu
          extensions={links}
          onSelect={(extension) => {
            if (extension.path) {
              window.location.href = extension.path;
            }
          }}
        />
      }
    >
      <IconButton
        name="ellipsis-v"
        aria-label={t('alerting.alert-instance-extension-point.actions', 'Alert instance actions')}
      />
    </Dropdown>
  );
}
