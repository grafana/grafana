import React, { ReactElement, useMemo, useState } from 'react';

import { PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { ConfirmNavigationModal } from 'app/features/explore/extensions/ConfirmNavigationModal';
import { Alert, CombinedRule } from 'app/types/unified-alerting';

import { AlertExtensionPointMenu } from './AlertInstanceExtensionPointMenu';

interface AlertInstanceExtensionPointProps {
  rule?: CombinedRule;
  instance: Alert;
  extensionPointId: PluginExtensionPoints;
}

export const AlertInstanceExtensionPoint = ({
  rule,
  instance,
  extensionPointId,
}: AlertInstanceExtensionPointProps): ReactElement | null => {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const context = { instance, rule };
  const extensions = useExtensionLinks(context, extensionPointId);

  if (extensions.length === 0) {
    return null;
  }

  const menu = <AlertExtensionPointMenu extensions={extensions} onSelect={setSelectedExtension} />;
  return (
    <>
      <Dropdown placement="bottom-start" overlay={menu}>
        <IconButton name="ellipsis-v" aria-label="Actions" variant="secondary" />
      </Dropdown>
      {!!selectedExtension && !!selectedExtension.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
    </>
  );
};

export type PluginExtensionAlertInstanceContext = {
  rule?: CombinedRule;
  instance: Alert;
};

function useExtensionLinks(
  context: PluginExtensionAlertInstanceContext,
  extensionPointId: PluginExtensionPoints
): PluginExtensionLink[] {
  return useMemo(() => {
    const { extensions } = getPluginLinkExtensions({
      extensionPointId,
      context,
      limitPerPlugin: 3,
    });

    return extensions;
  }, [context, extensionPointId]);
}
