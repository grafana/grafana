import { ReactElement, useMemo, useState } from 'react';

import { PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { ConfirmNavigationModal } from 'app/features/explore/extensions/ConfirmNavigationModal';
// We might want to customise this in future but right now the toolbar menu from the Explore view is fine.
import { ToolbarExtensionPointMenu as AlertExtensionPointMenu } from 'app/features/explore/extensions/ToolbarExtensionPointMenu';
import { Alert, CombinedRule } from 'app/types/unified-alerting';

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
  const context = useMemo(() => ({ instance, rule }), [instance, rule]);
  const { links } = usePluginLinks({ context, extensionPointId, limitPerPlugin: 3 });

  if (links.length === 0) {
    return null;
  }

  const menu = <AlertExtensionPointMenu extensions={links} onSelect={setSelectedExtension} />;
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
