import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  isSceneObject,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObject,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

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
      <span className={styles.hintCircle} />
      <Icon name="ai-sparkle" size="xs" className={styles.hintSparkle} />
    </span>
  );
}

/**
 * Injects an AI sparkle hint icon into the titleItems of every VizPanel on the dashboard.
 * The icon is hidden by default and revealed on panel hover via CSS.
 */
export function addAssistantHintsToAllPanels(dashboard: SceneObject) {
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

export function removeAssistantHintsFromAllPanels(dashboard: SceneObject) {
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
export function useAssistantPanelHints(dashboard: SceneObject, isEditing: boolean | undefined, isEnabled: boolean) {
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
      justifyContent: 'center',
      position: 'relative',
      width: 20,
      height: 20,
      cursor: 'pointer',
      opacity: 0,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'opacity 150ms ease-in-out',
      },

      '.dashboard-selectable-element:hover &, [class*="panel-container"]:hover &': {
        opacity: 1,
      },
    }),
    hintCircle: css({
      position: 'absolute',
      inset: 0,
      borderRadius: theme.shape.radius.circle,
      background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(249, 115, 22))',
    }),
    hintSparkle: css({
      position: 'relative',
      color: '#fff',
      zIndex: 1,
    }),
  };
}
