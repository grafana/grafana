import { type ReactElement } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

export interface MegaMenuSectionProps {
  /**
   * Closes the mega menu after the section navigates or opens something. Set only while the menu overlays the
   * page; a docked menu stays open.
   */
  onNavigate?: () => void;
  /**
   * Whether the user has folded the section to its heading, at the bottom of the menu. A folded section renders
   * only its heading; the navigation takes the rest of the menu.
   */
  collapsed: boolean;
  /** Folds the section to its heading, or unfolds it, from a control in its heading. The menu remembers it. */
  onCollapsedChange: (collapsed: boolean) => void;
}

/**
 * The section below the mega menu's navigation, for example the Assistant's conversations, or `null` when no
 * plugin fills it. Only the Assistant can, with one component that owns the section's heading, content and
 * scrolling: the menu gives it the height the navigation leaves.
 */
export function useMegaMenuSectionExtension({
  onNavigate,
  collapsed,
  onCollapsedChange,
}: MegaMenuSectionProps): ReactElement | null {
  const { components } = usePluginComponents<MegaMenuSectionProps>({
    extensionPointId: PluginExtensionPoints.MegaMenuSection,
  });

  return renderLimitedComponents({
    props: { onNavigate, collapsed, onCollapsedChange },
    components,
    limit: 1,
    pluginId: ASSISTANT_PLUGIN_ID,
  });
}
