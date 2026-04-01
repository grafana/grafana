import { type ReactElement, useMemo, useState } from 'react';

import { type PluginExtensionLink, type PluginExtensionPoints, PluginExtensionTypes } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { ConfirmNavigationModal } from 'app/features/explore/extensions/ConfirmNavigationModal';
// We might want to customise this in future but right now the toolbar menu from the Explore view is fine.
import { ToolbarExtensionPointMenu as AlertExtensionPointMenu } from 'app/features/explore/extensions/ToolbarExtensionPointMenu';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

interface AlertInstanceExtensionPointProps {
  rule?: CombinedRule;
  instance: Alert;
  extensionPointId: PluginExtensionPoints;
  showPreviewRouting?: boolean;
}

const PREVIEW_ROUTING_EXTENSION_BASE = {
  type: PluginExtensionTypes.link,
  id: 'preview-routing',
  pluginId: 'grafana',
  description: '',
  onClick: () => {},
} satisfies Omit<PluginExtensionLink, 'title'>;

export const AlertInstanceExtensionPoint = ({
  rule,
  instance,
  extensionPointId,
  showPreviewRouting,
}: AlertInstanceExtensionPointProps): ReactElement | null => {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const context = useMemo(() => ({ instance, rule }), [instance, rule]);
  const { links } = usePluginLinks({ context, extensionPointId, limitPerPlugin: 3 });

  const allLinks = useMemo(
    () =>
      showPreviewRouting
        ? [
            ...links,
            {
              ...PREVIEW_ROUTING_EXTENSION_BASE,
              title: t('alerting.alert-instance-extension-point.preview-routing', 'Preview routing'),
            },
          ]
        : links,
    [links, showPreviewRouting]
  );

  if (allLinks.length === 0) {
    return null;
  }

  const menu = <AlertExtensionPointMenu extensions={allLinks} onSelect={setSelectedExtension} />;
  return (
    <>
      <Dropdown placement="bottom-start" overlay={menu}>
        <IconButton
          name="ellipsis-v"
          aria-label={t('alerting.alert-instance-extension-point.aria-label-actions', 'Actions')}
          variant="secondary"
        />
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
