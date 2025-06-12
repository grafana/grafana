import { useCallback, useEffect, useState } from 'react';

import { ComponentTypeWithExtensionMeta, PluginExtensionPoints, PluginExtensionPopupContext } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

import { PopupExtensionOverlay } from './PopupExtensionOverlay';

type FilteredComponent = ComponentTypeWithExtensionMeta<PluginExtensionPopupContext>;

export const PopupExtension = () => {
  const [filteredComponents, setFilteredComponents] = useState<FilteredComponent[]>([]);
  const { components, isLoading } = usePluginComponents<PluginExtensionPopupContext>({
    extensionPointId: PluginExtensionPoints.PopupExtension,
  });

  useEffect(() => {
    setFilteredComponents(components.filter((component) => component.meta.pluginId === 'grafana-setupguide-app'));
  }, [components]);

  const onDismiss = useCallback(() => {
    setFilteredComponents(filteredComponents.slice(1));
  }, [filteredComponents]);

  if (isLoading || !filteredComponents.length || !filteredComponents[0]) {
    return null;
  }

  const Component = filteredComponents[0];

  return (
    <PopupExtensionOverlay isOpen={true} onDismiss={onDismiss}>
      <Component onClose={onDismiss} />
    </PopupExtensionOverlay>
  );
};
