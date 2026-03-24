import { css, keyframes } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AssistantPromptCard, createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { getAnimatedBorderClass } from './DashboardAssistantViewMode';

interface ViewModePanelPromptCardProps {
  panel: VizPanel;
  /** A DOM element inside the panel (e.g. the sparkle button). Used to locate the panel container. */
  hintEl: HTMLElement;
  onClose: () => void;
}

/**
 * Renders a floating AssistantPromptCard below a VizPanel in dashboard view mode.
 * Uses Floating UI for positioning and creates a portal to render outside the panel DOM hierarchy.
 * Applies an animated gradient border to the active panel.
 */
export function ViewModePanelPromptCard({ panel, hintEl, onClose }: ViewModePanelPromptCardProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  // Walk up from the sparkle button to find the panel's <section> element.
  // PanelChrome renders: <div> → <section class="...-panel-container"> → header → titleItems → button.
  // Using `section[class*="panel-container"]` targets the individual panel precisely,
  // even inside repeated rows/panels where a parent wrapper may also exist.
  const anchorEl = useMemo(() => {
    const section = hintEl.closest<HTMLElement>('section[class*="panel-container"]');
    return section ?? hintEl;
  }, [hintEl]);

  // Apply animated border to the active panel's DOM element
  const borderClass = useMemo(() => getAnimatedBorderClass(theme), [theme]);
  useEffect(() => {
    anchorEl.classList.add(borderClass);
    return () => anchorEl.classList.remove(borderClass);
  }, [anchorEl, borderClass]);

  // Close the popover when the anchor element is removed from the DOM
  // (e.g. when a row is collapsed). Polls via rAF because MutationObserver
  // on the parent won't fire when a grandparent is removed, and the scene
  // object may not deactivate when its React component unmounts.
  useEffect(() => {
    let rafId: number;
    const check = () => {
      if (!anchorEl.isConnected) {
        onClose();
        return;
      }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafId);
  }, [anchorEl, onClose]);

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
  }, [panel]);

  useEffect(() => {
    if (!isPositioned) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [isPositioned, panel]);

  const context = useMemo(
    () => [
      createAssistantContextItem('structured', {
        title: panel.state.title || 'Panel',
        data: {
          panelKey: panel.state.key,
          panelTitle: panel.state.title,
          pluginId: panel.state.pluginId,
        },
      }),
    ],
    [panel]
  );

  const promptPlaceholder = t('dashboard.panel-assistant.prompt-card.placeholder', 'Ask Assistant about this panel...');

  const closedExplicitlyRef = useRef(false);

  useEffect(() => {
    if (visible) {
      closedExplicitlyRef.current = false;
      reportInteraction('dashboards_assistant_popover_displayed', {
        panelCount: 1,
        pluginIds: [panel.state.pluginId],
      });

      return () => {
        if (!closedExplicitlyRef.current) {
          reportInteraction('dashboards_assistant_popover_closed', { action: 'click_outside' });
        }
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, panel]);

  const handleClose = useCallback(() => {
    closedExplicitlyRef.current = true;
    reportInteraction('dashboards_assistant_popover_closed', { action: 'escape' });
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    (prompt: string) => {
      closedExplicitlyRef.current = true;
      reportInteraction('dashboards_assistant_popover_prompt_submitted', {
        panelCount: 1,
        promptLength: prompt.length,
      });
      onClose();
    },
    [onClose]
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
      <AssistantPromptCard
        origin="grafana/dashboard/panel-popover"
        context={context}
        placeholder={promptPlaceholder}
        animated={false}
        onClose={handleClose}
        onSubmit={handleSubmit}
        className={styles.card}
      />
    </div>,
    document.body
  );
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
