import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  isSceneObject,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';

const HINT_KEY_PREFIX = 'assistant-hint-';

export function panelHasData(panel: VizPanel): boolean {
  return panel.state.$data != null || panel.parent?.state.$data != null;
}

export class PanelAssistantHintItem extends SceneObjectBase<SceneObjectState> {
  static Component = PanelAssistantHintRenderer;
}

function PanelAssistantHintRenderer(_props: SceneComponentProps<PanelAssistantHintItem>) {
  const styles = useStyles2(getHintStyles);

  return (
    <span className={styles.hintIcon} data-testid="panel-assistant-hint">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="assistant-hint-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(168, 85, 247)" />
            <stop offset="100%" stopColor="rgb(249, 115, 22)" />
          </linearGradient>
        </defs>
      </svg>
      <Icon name="ai-sparkle" size="sm" />
    </span>
  );
}

/**
 * Injects an AI sparkle hint icon into the titleItems of every VizPanel on the dashboard.
 * The icon is hidden by default and revealed on panel hover via CSS.
 */
export function addAssistantHintsToAllPanels(dashboard: DashboardScene) {
  const objects = sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof VizPanel);

  for (const obj of objects) {
    if (obj instanceof VizPanel && panelHasData(obj)) {
      addAssistantHintToPanel(obj);
    }
  }
}

export function addAssistantHintToPanel(panel: VizPanel) {
  const key = `${HINT_KEY_PREFIX}${panel.state.key}`;

  const existingItems = panel.state.titleItems;
  if (existingItems) {
    if (Array.isArray(existingItems)) {
      if (existingItems.some((item) => item instanceof PanelAssistantHintItem)) {
        return;
      }
      panel.setState({ titleItems: [...existingItems, new PanelAssistantHintItem({ key })] });
    } else if (existingItems instanceof PanelAssistantHintItem) {
      return;
    } else if (isSceneObject(existingItems)) {
      panel.setState({ titleItems: [existingItems, new PanelAssistantHintItem({ key })] });
    } else {
      panel.setState({ titleItems: new PanelAssistantHintItem({ key }) });
    }
  } else {
    panel.setState({ titleItems: new PanelAssistantHintItem({ key }) });
  }
}

export function removeAssistantHintsFromAllPanels(dashboard: DashboardScene) {
  const objects = sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof VizPanel);

  for (const obj of objects) {
    if (obj instanceof VizPanel) {
      removeAssistantHintFromPanel(obj);
    }
  }
}

function removeAssistantHintFromPanel(panel: VizPanel) {
  const existingItems = panel.state.titleItems;
  if (!existingItems) {
    return;
  }

  if (existingItems instanceof PanelAssistantHintItem) {
    panel.setState({ titleItems: undefined });
  } else if (Array.isArray(existingItems)) {
    const filtered = existingItems.filter((item) => !(item instanceof PanelAssistantHintItem));
    panel.setState({ titleItems: filtered.length > 0 ? filtered : undefined });
  }
}

/**
 * Manages the lifecycle of assistant hint icons on dashboard panels.
 * Adds hints in view mode when the assistant popover is enabled, removes them otherwise.
 */
export function useAssistantPanelHints(dashboard: DashboardScene, isEditing: boolean | undefined, isEnabled: boolean) {
  useEffect(() => {
    if (!isEditing && isEnabled) {
      addAssistantHintsToAllPanels(dashboard);
      return () => removeAssistantHintsFromAllPanels(dashboard);
    }
    removeAssistantHintsFromAllPanels(dashboard);
    return undefined;
  }, [isEditing, isEnabled, dashboard]);
}

function getHintStyles(theme: GrafanaTheme2) {
  return {
    hintIcon: css({
      label: 'panel-assistant-hint',
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer',
      opacity: 0,
      color: theme.colors.text.secondary,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 150ms ease-in-out',
      },

      '& svg:last-child': {
        fill: 'url(#assistant-hint-gradient)',
      },

      '.dashboard-selectable-element:hover &': {
        opacity: 1,
      },
    }),
  };
}
