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

export function getLimitedComponents<Props>({
  props,
  components,
  limit,
  pluginIdPatterns,
}: {
  props: Props;
  components: Array<ComponentTypeWithExtensionMeta<Props>>;
  limit?: number;
  pluginIdPatterns?: string[];
}) {
  if (!components.length) {
    return null;
  }

  const renderedComponents: Array<ComponentTypeWithExtensionMeta<Props>> = [];

  for (const Component of components) {
    const { meta } = Component;

    if (pluginIdPatterns && !createRegexFromPluginIdPatterns(pluginIdPatterns).test(meta.pluginId)) {
      continue;
    }

    // If no limit is provided, return all components
    if (limit === undefined) {
      renderedComponents.push(Component);
      continue;
    }

    if ((Component as Function)(props) != null) {
      renderedComponents.push(Component);
    }

    // Stop if we've reached the limit
    if (renderedComponents.length >= limit) {
      break;
    }
  }

  return renderedComponents;
}

export function renderLimitedComponents<Props>({
  props,
  components,
  limit,
  pluginIdPatterns,
}: {
  props: Props;
  components: Array<ComponentTypeWithExtensionMeta<Props>>;
  limit?: number;
  pluginIdPatterns?: string[];
}) {
  const limitedComponents = getLimitedComponents({ props, components, limit, pluginIdPatterns });

  if (!limitedComponents?.length) {
    return null;
  }

  return (
    <>
      {limitedComponents.map((Component, index) => (
        <Component key={index} {...props} />
      ))}
    </>
  );
}

export function createRegexFromPluginIdPatterns(patterns: string[]): RegExp {
  const regexPatterns = patterns.map((pattern) => pattern.replace(/\*/g, '.*'));

  return new RegExp(`^(${regexPatterns.join('|')})$`);
}
