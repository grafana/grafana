import { css, keyframes } from '@emotion/css';
import { useEffect } from 'react';

import { useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneObject, VizPanel } from '@grafana/scenes';

import { ElementSelection } from './ElementSelection';
import { panelHasData, useAssistantPanelHints } from './PanelAssistantHint';
import { EditPaneSelectionActions } from './types';

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
  // TODO: remove hardcoded true before merging — for local dev without assistant backend
  const isEnabled =
    !!config.featureToggles.dashboardAssistantPopover &&
    config.bootData.user.isSignedIn &&
    (isAssistantAvailable || true);

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

export function getAssistantViewModeStyles(theme: GrafanaTheme2) {
  const bg = theme.colors.background.canvas;
  const c1 = 'rgb(168, 85, 247)';
  const c2 = 'rgb(249, 115, 22)';

  const selectionBorderFrames: Record<string, { backgroundImage: string }> = {};
  for (let i = 0; i <= 100; i++) {
    selectionBorderFrames[`${i}%`] = {
      backgroundImage: `linear-gradient(${bg}, ${bg}), conic-gradient(from ${i * 3.6}deg, transparent 60%, ${c1} 80%, ${c2} 100%, transparent 15%)`,
    };
  }
  const selectionBorderAnimation = keyframes(selectionBorderFrames);

  return {
    viewModeHoverOverride: css({
      '.dashboard-selectable-element:not(.dashboard-selected-element):hover': {
        outline: 'none',
        backgroundColor: 'transparent',
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
          conic-gradient(from 0deg, transparent 60%, ${c1} 80%, ${c2} 100%, transparent 15%)
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
