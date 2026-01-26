import { memo } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { useBottomDrawerContext } from './BottomDrawerProvider';

export const BottomDrawerButton = memo(function BottomDrawerButton() {
  const { isOpen, setDockedComponentId, availableComponents } = useBottomDrawerContext();

  // TODO: Remove this temporary bypass once grafana-grafanacoda-app plugin registers extensions
  // For now, always show the button for development/testing purposes
  const TEMP_ALWAYS_SHOW_BUTTON = true;

  // Only show the button if there are extension point components available
  if (!TEMP_ALWAYS_SHOW_BUTTON && availableComponents.size === 0) {
    return null;
  }

  // Get the first available plugin component for display purposes
  const entries = Array.from(availableComponents.entries());
  const firstEntry = entries[0];
  const firstPluginId = firstEntry?.[0];
  const firstPluginMeta = firstEntry?.[1];
  const firstComponent = firstPluginMeta?.addedComponents[0];
  const componentTitle = firstComponent?.title ?? 'Bottom drawer';

  return (
    <ToolbarButton
      iconOnly
      icon="brackets-curly"
      aria-label={t('navigation.bottom-drawer.aria-label', 'Open bottom drawer')}
      variant={isOpen ? 'active' : 'default'}
      tooltip={
        isOpen
          ? t('navigation.bottom-drawer.close-tooltip', 'Close {{title}}', { title: componentTitle })
          : t('navigation.bottom-drawer.open-tooltip', 'Open {{title}}', { title: componentTitle })
      }
      onClick={() => {
        if (isOpen) {
          setDockedComponentId(undefined);
        } else {
          // Open the first available extension component
          if (firstPluginId && firstComponent) {
            setDockedComponentId(JSON.stringify({ pluginId: firstPluginId, componentTitle: firstComponent.title }));
          }
        }
      }}
    />
  );
});
