import { css, keyframes } from '@emotion/css';
import { useEffect } from 'react';

import { useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneObject, VizPanel } from '@grafana/scenes';

import { ElementSelection } from '../edit-pane/ElementSelection';
import { EditPaneSelectionActions } from '../edit-pane/types';

import { panelHasData, useAssistantPanelHints } from './PanelAssistantHint';

interface DashboardAssistantViewModeProps {
  dashboard: SceneObject;
  editPane: EditPaneSelectionActions;
  isEditing: boolean | undefined;
  selection: ElementSelection | undefined;
}

/**
 * Manages all assistant-related behavior in dashboard view mode:
 * - Checks assistant availability and feature toggle
 * - Enables panel selection in view mode
 * - Injects AI sparkle hint icons on panels with data
 * - Clears selection on non-data panels
 * - Renders the floating prompt card on panel selection
 * - Provides CSS class names for view mode selection styling
 */
export function useDashboardAssistantViewMode({
  dashboard,
  editPane,
  isEditing,
  selection,
}: DashboardAssistantViewModeProps) {
  const { isAvailable: isAssistantAvailable } = useAssistant();
  const isEnabled =
    !!config.featureToggles.dashboardAssistantPopover && config.bootData.user.isSignedIn && isAssistantAvailable;

  useAssistantPanelHints(dashboard, isEditing, isEnabled);

  useEffect(() => {
    if (!isEditing && isEnabled && selection && !hasSelectedVizPanelsWithData(selection)) {
      editPane.clearSelection(true);
    }
  }, [isEditing, isEnabled, selection, editPane]);

  const isViewModeWithPanelSelected = !isEditing && isEnabled && hasSelectedVizPanelsWithData(selection);

  return {
    isEnabled,
    isViewModeWithPanelSelected,
  };
}

function hasSelectedVizPanelsWithData(selection: ElementSelection | undefined): boolean {
  if (!selection) {
    return false;
  }

  const selected = selection.getSelection();
  if (Array.isArray(selected)) {
    return selected.length > 0 && selected.every((obj) => obj instanceof VizPanel && panelHasData(obj));
  }
  return selected instanceof VizPanel && panelHasData(selected);
}

// Register a custom CSS property so the browser can interpolate the angle natively,
// avoiding 101 keyframe steps for the conic-gradient rotation.
if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
  try {
    CSS.registerProperty({
      name: '--border-angle',
      syntax: '<angle>',
      initialValue: '0deg',
      inherits: false,
    });
  } catch {
    // Already registered — ignore
  }
}

const selectionBorderAnimation = keyframes({
  '0%': { '--border-angle': '0deg' },
  '100%': { '--border-angle': '360deg' },
});

export function getAssistantViewModeStyles(theme: GrafanaTheme2) {
  const bg = theme.colors.background.canvas;
  const c1 = 'rgb(168, 85, 247)';
  const c2 = 'rgb(249, 115, 22)';

  return {
    viewModeHoverOverride: css({
      '.dashboard-selectable-element:not(.dashboard-selected-element):hover': {
        outline: 'none',
        backgroundColor: theme.colors.background.primary,
      },
      '.dashboard-selected-element': {
        outline: 'none',
      },
    }),
    viewModeAnimatedBorder: css({
      '.dashboard-selected-element': {
        outline: 'none',
        border: '1px solid transparent',
        backgroundImage: `
          linear-gradient(${bg}, ${bg}),
          conic-gradient(from var(--border-angle), transparent 60%, ${c1} 80%, ${c2} 100%, transparent 15%)
        `,
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        [theme.transitions.handleMotion('no-preference')]: {
          animation: `${selectionBorderAnimation} 2s linear infinite`,
        },
      },
    }),
  };
}
