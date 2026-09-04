import { type ReactElement, useMemo, useState } from 'react';

import { type PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { ConfirmNavigationModal } from './ConfirmationNavigationModal';
import { AlertingRuleExtensionPointMenu } from './AlertingRuleExtensionPointMenu';

interface Props {
  rule?: CombinedRule;
  instance: Alert;
}

export type PluginExtensionAlertInstanceContext = {
  rule?: {
    name: string;
    query: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    uid?: string;
  };
  instance: {
    activeAt: string;
    annotations: Record<string, string>;
    labels: Record<string, string>;
    state: string;
    value: string;
  };
};

export function AlertInstanceExtensionPoint({ rule, instance }: Props): ReactElement | null {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();

  const context = useMemo<PluginExtensionAlertInstanceContext>(() => {
    const flatRuleData = rule
      ? {
          name: rule.name,
          query: rule.query,
          labels: rule.labels ?? {},
          annotations: rule.annotations ?? {},
          uid: rule.promRule?.uid,
        }
      : undefined;

    return {
      rule: flatRuleData,
      instance: {
        activeAt: instance.activeAt,
        annotations: instance.annotations,
        labels: instance.labels,
        state: instance.state,
        value: instance.value,
      },
    };
  }, [rule, instance]);

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
