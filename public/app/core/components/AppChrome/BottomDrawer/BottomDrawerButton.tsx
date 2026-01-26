import { memo } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';

import { useBottomDrawerContext } from './BottomDrawerProvider';

export const BottomDrawerButton = memo(function BottomDrawerButton() {
  const { isOpen, setDockedComponentId, availableComponents } = useBottomDrawerContext();

  // Only show the button if the feature flag is enabled and there are extension point components available
  if (!config.featureToggles.bottomDrawer || availableComponents.size === 0) {
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
      data-testid={`bottom-drawer-button-${isOpen ? 'close' : 'open'}`}
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
