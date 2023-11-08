import React, { ReactElement, useMemo, useState } from 'react';

import { PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { ConfirmNavigationModal } from 'app/features/explore/extensions/ConfirmNavigationModal';
import { Alert } from 'app/types/unified-alerting';

import { AlertExtensionPointMenu } from './AlertInstanceExtensionPointMenu';

interface AlertInstanceExtensionPointProps {
  instance: Alert;
  extensionPointId: PluginExtensionPoints;
}

export const AlertInstanceExtensionPoint = ({
  instance,
  extensionPointId,
}: AlertInstanceExtensionPointProps): ReactElement | null => {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const context = { instance };
  const extensions = useExtensionLinks(context, extensionPointId);

  const menu = <AlertExtensionPointMenu extensions={extensions} onSelect={setSelectedExtension} />;
  return (
    <>
      <Dropdown placement="bottom-start" overlay={menu}>
        <IconButton name="bars" aria-label="Actions" disabled={extensions.length === 0} variant="secondary">
          Actions
        </IconButton>
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

export type PluginExtensionAlertListItemContext = {
  instance: Alert;
};

export type PluginExtensionAlertInstanceContext = {
  instance: Alert;
};

type Context = PluginExtensionAlertListItemContext | PluginExtensionAlertInstanceContext;

function useExtensionLinks(context: Context, extensionPointId: PluginExtensionPoints): PluginExtensionLink[] {
  return useMemo(() => {
    const { extensions } = getPluginLinkExtensions({
      extensionPointId,
      context,
      limitPerPlugin: 3,
    });

    return extensions;
  }, [context, extensionPointId]);
}
