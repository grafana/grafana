import { css, keyframes } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AssistantPromptCard, createAssistantContextItem } from '@grafana/assistant';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';

import { type PopoverTarget } from './AssistantPopoverContext';
import { getAnimatedBorderClass } from './DashboardAssistantViewMode';

interface ViewModePanelPromptCardProps {
  targets: PopoverTarget[];
  onClose: () => void;
}

/**
 * Renders a floating AssistantPromptCard below selected VizPanels in dashboard view mode.
 * Supports multi-panel selection: the popover anchors to the last selected panel,
 * and all selected panels get an animated gradient border.
 */
export function ViewModePanelPromptCard({ targets, onClose }: ViewModePanelPromptCardProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  // Anchor to the last selected panel
  const lastTarget = targets[targets.length - 1];
  const hintEl = lastTarget.anchorEl;

  // Walk up from the sparkle button to find the panel's <section> element.
  const anchorEl = useMemo(() => {
    const section = hintEl.closest<HTMLElement>('section[class*="panel-container"]');
    return section ?? hintEl;
  }, [hintEl]);

  // Resolve all panel <section> elements for border styling
  const allAnchorEls = useMemo(
    () =>
      targets.map((t) => {
        const section = t.anchorEl.closest<HTMLElement>('section[class*="panel-container"]');
        return section ?? t.anchorEl;
      }),
    [targets]
  );

  // Apply animated border to ALL selected panels
  const borderClass = useMemo(() => getAnimatedBorderClass(theme), [theme]);
  useEffect(() => {
    for (const el of allAnchorEls) {
      el.classList.add(borderClass);
    }
    return () => {
      for (const el of allAnchorEls) {
        el.classList.remove(borderClass);
      }
    };
  }, [allAnchorEls, borderClass]);

  // Close the popover when any anchor element is removed from the DOM
  // (e.g. when a row is collapsed).
  useEffect(() => {
    let rafId: number;
    const check = () => {
      const anyDisconnected = allAnchorEls.some((el) => !el.isConnected);
      if (anyDisconnected) {
        onClose();
        return;
      }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafId);
  }, [allAnchorEls, onClose]);

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
    if (!isPositioned) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [isPositioned, anchorEl]);

  const context = useMemo(
    () =>
      targets.map((t) =>
        createAssistantContextItem('structured', {
          title: t.panel.state.title || 'Panel',
          data: {
            panelKey: t.panel.state.key,
            panelTitle: t.panel.state.title,
            pluginId: t.panel.state.pluginId,
          },
        })
      ),
    [targets]
  );

  const promptPlaceholder =
    targets.length > 1
      ? t('dashboard.panel-assistant.prompt-card.placeholder-multi', 'Ask Assistant about these panels...')
      : t('dashboard.panel-assistant.prompt-card.placeholder', 'Ask Assistant about this panel...');

  const closedExplicitlyRef = useRef(false);
  const targetKeys = useMemo(() => targets.map((t) => t.panel.state.key).join(','), [targets]);

  useEffect(() => {
    if (visible) {
      closedExplicitlyRef.current = false;
      reportInteraction('dashboards_assistant_popover_displayed', {
        panelCount: targets.length,
        pluginIds: targets.map((t) => t.panel.state.pluginId),
      });

      return () => {
        if (!closedExplicitlyRef.current) {
          reportInteraction('dashboards_assistant_popover_closed', { action: 'click_outside' });
        }
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, targetKeys]);

  const handleClose = useCallback(() => {
    closedExplicitlyRef.current = true;
    reportInteraction('dashboards_assistant_popover_closed', { action: 'escape' });
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    (prompt: string) => {
      closedExplicitlyRef.current = true;
      reportInteraction('dashboards_assistant_popover_prompt_submitted', {
        panelCount: targets.length,
        promptLength: prompt.length,
      });
      onClose();
    },
    [onClose, targets.length]
  );

  const hiddenStyle = {
    position: 'fixed' as const,
    top: -9999,
    left: -9999,
    opacity: 0,
    pointerEvents: 'none' as const,
  };

  const isVisible = visible && anchorEl.isConnected;

  return createPortal(
    <div
      ref={refs.setFloating}
      style={isVisible ? floatingStyles : hiddenStyle}
      className={isVisible ? styles.floatingContainer : undefined}
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
