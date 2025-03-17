import React from 'react';

import {
  ComponentTypeWithExtensionMeta,
  type PluginExtension,
  type PluginExtensionComponent,
  type PluginExtensionLink,
  PluginExtensionTypes,
} from '@grafana/data';

export function isPluginExtensionLink(extension: PluginExtension | undefined): extension is PluginExtensionLink {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.link && ('path' in extension || 'onClick' in extension);
}

export function isPluginExtensionComponent(
  extension: PluginExtension | undefined
): extension is PluginExtensionComponent {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.component && 'component' in extension;
}

export function getLimitedComponentsToRender<Props extends {}>({
  props,
  components,
  limit,
  pluginId,
}: {
  props: Props;
  components: Array<ComponentTypeWithExtensionMeta<Props>>;
  limit?: number;
  pluginId?: string | string[] | RegExp;
}) {
  if (!components.length) {
    return null;
  }

  const renderedComponents: Array<ComponentTypeWithExtensionMeta<Props>> = [];

  for (const Component of components) {
    const { meta } = Component;

    if (pluginId && typeof pluginId === 'string' && pluginId !== meta.pluginId) {
      continue;
    }

    if (pluginId && Array.isArray(pluginId) && !pluginId.includes(meta.pluginId)) {
      continue;
    }

    if (pluginId instanceof RegExp && !pluginId.test(meta.pluginId)) {
      continue;
    }

    // If no limit is provided, return all components
    if (limit === undefined) {
      renderedComponents.push(Component);
      continue;
    }

    // If a component does not render anything, do not count it in the limit
    if (React.createElement<Props>(Component, props) !== null) {
      renderedComponents.push(Component);
    }

    // Stop if we've reached the limit
    if (renderedComponents.length >= limit) {
      break;
    }
  }

  return renderedComponents;
}

export function renderLimitedComponents<Props extends {}>({
  props,
  components,
  limit,
  pluginId,
}: {
  props: Props;
  components: Array<ComponentTypeWithExtensionMeta<Props>>;
  limit?: number;
  pluginId?: string | string[] | RegExp;
}) {
  const limitedComponents = getLimitedComponentsToRender({ props, components, limit, pluginId });

  if (!limitedComponents?.length) {
    return null;
  }

  return (
    <>
      {limitedComponents.map((Component) => (
        <Component key={Component.meta.id} {...props} />
      ))}
    </>
  );
}
