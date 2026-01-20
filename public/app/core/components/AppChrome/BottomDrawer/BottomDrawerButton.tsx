import { memo } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { useBottomDrawerContext } from './BottomDrawerProvider';

export const BottomDrawerButton = memo(function BottomDrawerButton() {
  const { isOpen, setDockedComponentId, availableComponents } = useBottomDrawerContext();

  // Only show the button if there are extension point components available
  if (availableComponents.size === 0) {
    return null;
  }

  // Get the first available plugin component for display purposes
  const firstPlugin = Array.from(availableComponents.entries())[0];
  const firstComponent = firstPlugin?.[1]?.addedComponents[0];
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
          if (firstPlugin) {
            const [pluginId, pluginMeta] = firstPlugin;
            const component = pluginMeta.addedComponents[0];
            if (component) {
              setDockedComponentId(JSON.stringify({ pluginId, componentTitle: component.title }));
            }
          }
        }
      }}
    />
  );
});
