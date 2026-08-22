import { type ReactElement, useMemo, useState } from 'react';

import { type PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

import { ConfirmNavigationModal } from './ConfirmationNavigationModal';
import { AlertingRuleExtensionPointMenu } from './AlertingRuleExtensionPointMenu';

interface Props {
  rule?: CombinedRule;
  instance: Alert;
}

export type PluginExtensionAlertInstanceContext = {
  rule?: CombinedRule;
  instance: Alert;
};

export function AlertInstanceExtensionPoint({ rule, instance }: Props): ReactElement | null {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();

  const context = useMemo<PluginExtensionAlertInstanceContext>(() => ({ rule, instance }), [rule, instance]);

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertInstanceAction,
    context,
    limitPerPlugin: 3,
  });

  if (links.length === 0) {
    return null;
  }

  return (
    <>
      <Dropdown
        placement="bottom-start"
        overlay={<AlertingRuleExtensionPointMenu extensions={links} onSelect={setSelectedExtension} />}
      >
        <IconButton
          name="ellipsis-v"
          aria-label={t('alerting.alert-instance-extension-point.actions', 'Alert instance actions')}
          variant="secondary"
        />
      </Dropdown>

      {!!selectedExtension?.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
    </>
  );
}
