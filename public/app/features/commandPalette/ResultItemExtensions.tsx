import { PluginExtensionPoints, type PluginExtensionCommandPaletteResultItemV1Context } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

interface Props {
  context: PluginExtensionCommandPaletteResultItemV1Context;
}

/**
 * Renders plugin-provided content for a single dashboard row in the command palette. Each plugin
 * gets a single slot to keep the row compact.
 */
export function ResultItemExtensions({ context }: Props) {
  const { components, isLoading } = usePluginComponents<PluginExtensionCommandPaletteResultItemV1Context>({
    extensionPointId: PluginExtensionPoints.CommandPaletteResultItem,
    limitPerPlugin: 1,
  });

  if (isLoading || !components.length) {
    return null;
  }

  return (
    <>
      {components.map((Component) => (
        <Component key={Component.meta.id} {...context} />
      ))}
    </>
  );
}
