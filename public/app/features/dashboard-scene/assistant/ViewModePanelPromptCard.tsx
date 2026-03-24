import { css, keyframes } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AssistantPromptCard, createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { SceneObject, VizPanel, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ElementSelection } from '../edit-pane/ElementSelection';
import { EditPaneSelectionActions } from '../edit-pane/types';

import { panelHasData } from './PanelAssistantHint';

interface ViewModePanelPromptCardProps {
  selection: ElementSelection | undefined;
  editPane: EditPaneSelectionActions;
  dashboard: SceneObject;
}

/**
 * Renders a floating AssistantPromptCard below a selected VizPanel in dashboard view mode.
 * Uses Floating UI for positioning and creates a portal to render outside the panel DOM hierarchy.
 */
export function ViewModePanelPromptCard({ selection, editPane, dashboard }: ViewModePanelPromptCardProps) {
  const selectedPanels = useSelectedVizPanels(selection);
  const firstPanel = selectedPanels.length > 0 ? selectedPanels[0] : null;
  const styles = useStyles2(getStyles);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!firstPanel?.state.key) {
      setAnchorEl(null);
      return;
    }
    const el = findPanelDomElement(firstPanel.state.key, dashboard);
    setAnchorEl(el);
  }, [firstPanel, dashboard]);

  const { refs, floatingStyles, isPositioned } = useFloating({
    placement: 'bottom',
    middleware: [offset(8), flip({ fallbackPlacements: ['top'] }), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });

  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    refs.setReference(anchorEl);
  }, [refs, anchorEl]);

  useEffect(() => {
    setVisible(false);
  }, [anchorEl]);

  useEffect(() => {
    if (!anchorEl || !isPositioned) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [anchorEl, isPositioned]);

  const context = usePanelsContext(selectedPanels);
  const promptPlaceholder =
    selectedPanels.length > 1
      ? t('dashboard.panel-assistant.prompt-card.placeholder-multi', 'Ask Assistant about these panels...')
      : t('dashboard.panel-assistant.prompt-card.placeholder', 'Ask Assistant about this panel...');

  const closedExplicitlyRef = useRef(false);
  const selectedPanelKeys = useMemo(() => selectedPanels.map((p) => p.state.key).join(','), [selectedPanels]);

  useEffect(() => {
    if (visible && selectedPanels.length > 0) {
      closedExplicitlyRef.current = false;
      reportInteraction('dashboards_assistant_popover_displayed', {
        panelCount: selectedPanels.length,
        pluginIds: selectedPanels.map((p) => p.state.pluginId),
      });

      return () => {
        if (!closedExplicitlyRef.current) {
          reportInteraction('dashboards_assistant_popover_closed', { action: 'click_outside' });
        }
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedPanelKeys]);

  const handleClose = useCallback(() => {
    closedExplicitlyRef.current = true;
    reportInteraction('dashboards_assistant_popover_closed', { action: 'escape' });
    editPane.clearSelection(true);
  }, [editPane]);

  const handleSubmit = useCallback(
    (prompt: string) => {
      closedExplicitlyRef.current = true;
      reportInteraction('dashboards_assistant_popover_prompt_submitted', {
        panelCount: selectedPanels.length,
        promptLength: prompt.length,
      });
      editPane.clearSelection(true);
    },
    [editPane, selectedPanels]
  );

  const hiddenStyle = {
    position: 'fixed' as const,
    top: -9999,
    left: -9999,
    opacity: 0,
    pointerEvents: 'none' as const,
  };

  return createPortal(
    <div
      ref={refs.setFloating}
      style={visible ? floatingStyles : hiddenStyle}
      className={visible ? styles.floatingContainer : undefined}
      data-testid="view-mode-panel-prompt-card"
    >
      {firstPanel && anchorEl && (
        <AssistantPromptCard
          origin="grafana/dashboard/panel-popover"
          context={context}
          placeholder={promptPlaceholder}
          animated={false}
          onClose={handleClose}
          onSubmit={handleSubmit}
          className={styles.card}
        />
      )}
    </div>,
    document.body
  );
}

function useSelectedVizPanels(selection: ElementSelection | undefined): VizPanel[] {
  return useMemo(() => {
    if (!selection) {
      return [];
    }

    const selected = selection.getSelection();
    if (Array.isArray(selected)) {
      return selected.filter((obj): obj is VizPanel => obj instanceof VizPanel && panelHasData(obj));
    }
    if (selected instanceof VizPanel && panelHasData(selected)) {
      return [selected];
    }
    return [];
  }, [selection]);
}

function findPanelDomElement(panelKey: string, dashboard: SceneObject): HTMLElement | null {
  try {
    const panel = sceneGraph.findByKey(dashboard, panelKey);
    if (!panel) {
      return null;
    }

    let current: SceneObject | undefined = panel;
    while (current) {
      if (hasContainerRef(current) && current.containerRef?.current) {
        return current.containerRef.current;
      }
      current = current.parent;
    }
  } catch {
    return null;
  }
  return null;
}

function usePanelsContext(panels: VizPanel[]) {
  return useMemo(() => {
    if (panels.length === 0) {
      return undefined;
    }

    return panels.map((panel) =>
      createAssistantContextItem('structured', {
        title: panel.state.title || 'Panel',
        data: {
          panelKey: panel.state.key,
          panelTitle: panel.state.title,
          pluginId: panel.state.pluginId,
        },
      })
    );
  }, [panels]);
}

const popIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

function getStyles(theme: GrafanaTheme2) {
  return {
    floatingContainer: css({
      label: 'view-mode-prompt-floating',
      zIndex: theme.zIndex.tooltip,
      width: 380,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${popIn} 150ms ease-out`,
      },
    }),
    card: css({
      label: 'view-mode-prompt-card',
      width: '100%',
    }),
  };
}

interface WithContainerRef {
  containerRef?: { current: HTMLElement | null };
}

function hasContainerRef(obj: SceneObject): obj is SceneObject & WithContainerRef {
  return 'containerRef' in obj;
}
