import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { Grid } from '@grafana/ui';

/**
 * Extension point that lets app plugins add their own entry points (cards) to the connections page.
 *
 * Plugins register a component for it via `addedComponents` in plugin.json and `AppPlugin.addComponent`.
 * The component renders one or more cards (e.g. `Card` from `@grafana/ui`) and receives
 * `ConnectionEntryPointProps`.
 */
export interface ConnectionEntryPointProps {
  /** The current search term. The component decides whether it matches and renders nothing if it does not. */
  searchTerm: string;
  /** Call with whether the component currently renders at least one card, so the page can show its empty state. */
  onVisibilityChange: (visible: boolean) => void;
}

interface SlotProps {
  id: string;
  Component: ComponentType<ConnectionEntryPointProps>;
  searchTerm: string;
  onVisibilityChange: (id: string, visible: boolean) => void;
}

function EntryPointSlot({ id, Component, searchTerm, onVisibilityChange }: SlotProps) {
  const handleVisibilityChange = useCallback(
    (visible: boolean) => onVisibilityChange(id, visible),
    [id, onVisibilityChange]
  );

  // A component that unmounts is no longer showing anything.
  useEffect(() => () => onVisibilityChange(id, false), [id, onVisibilityChange]);

  return <Component searchTerm={searchTerm} onVisibilityChange={handleVisibilityChange} />;
}

export interface ConnectionEntryPoints {
  /** True when at least one plugin component reports that it is showing cards for the current search. */
  hasVisibleEntryPoints: boolean;
  /** Ids of the plugins that contribute entry points, so their generic app card can be hidden. */
  pluginIds: Set<string>;
  /** Always render this, even while `hasVisibleEntryPoints` is false: plugins report visibility from inside it. */
  element: ReactNode;
}

export function useConnectionEntryPoints(searchTerm: string): ConnectionEntryPoints {
  const { components } = usePluginComponents<ConnectionEntryPointProps>({
    extensionPointId: PluginExtensionPoints.ConnectionsEntryPoints,
  });
  const [visibleById, setVisibleById] = useState<Record<string, boolean>>({});

  const handleVisibilityChange = useCallback((id: string, visible: boolean) => {
    setVisibleById((prev) => (Boolean(prev[id]) === visible ? prev : { ...prev, [id]: visible }));
  }, []);

  const pluginIds = useMemo(() => new Set(components.map((component) => component.meta.pluginId)), [components]);

  const element = useMemo(
    () =>
      components.length > 0 ? (
        <Grid gap={1.5} minColumnWidth={44}>
          {components.map((Component) => (
            <EntryPointSlot
              key={Component.meta.id}
              id={Component.meta.id}
              Component={Component}
              searchTerm={searchTerm}
              onVisibilityChange={handleVisibilityChange}
            />
          ))}
        </Grid>
      ) : null,
    [components, searchTerm, handleVisibilityChange]
  );

  return {
    hasVisibleEntryPoints: components.some((component) => visibleById[component.meta.id]),
    pluginIds,
    element,
  };
}
