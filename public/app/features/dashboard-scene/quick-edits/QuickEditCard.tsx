import { css, keyframes } from '@emotion/css';
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

import { colorManipulator, type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getPortalContainer, Icon, IconButton, Portal, useStyles2 } from '@grafana/ui';

const GAP = 8;

interface Props {
  title: string;
  icon: IconName;
  /** The panel being edited. The card sits beside it, so the change it makes stays in view. */
  panel: Element | null;
  /** The bar that opened the card. Presses on it don't close the card, and the card clears it when placed above. */
  bar: Element | null;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A card with one quick edit's controls, placed beside the panel: right of it, else left, else above or below.
 * It pulses once as it opens and outlines the panel while open, so both the card and what it changes stand out.
 * It stays open while menus it opens are used (they portal elsewhere) and closes on Escape or a press anywhere
 * else. Escape returns focus to the button that opened it.
 */
export function QuickEditCard({ title, icon, panel, bar, onClose, children }: Props) {
  const styles = useStyles2(getStyles);
  const {
    floatingStyles,
    refs: { setFloating, setReference },
  } = useFloating({
    placement: 'right-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      // Above the panel the card must also clear the bar, which sits on the panel's top edge.
      offset(({ placement }) => (placement.startsWith('top') ? GAP + (bar?.getBoundingClientRect().height ?? 0) : GAP)),
      flip({ fallbackPlacements: ['left-start', 'top-end', 'bottom-end'], padding: GAP }),
      shift({ padding: GAP }),
      size({
        padding: GAP,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(availableHeight, 160)}px`;
        },
      }),
    ],
  });

  useLayoutEffect(() => {
    setReference(panel);
  }, [panel, setReference]);

  // Set by a press anywhere in the card's React tree, which includes menus it portals elsewhere in the DOM.
  const pressedInside = useRef(false);
  const returnFocusTo = useRef(document.activeElement);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // In the capture phase, so a press that something else stops still closes the card. The verdict waits until the
    // press has reached the card's own handler.
    const onPress = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      const inside = target !== null && (bar?.contains(target) || getPortalContainer().contains(target));
      pressedInside.current = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!inside && !pressedInside.current) {
          onClose();
        }
      });
    };
    window.addEventListener('pointerdown', onPress, true);
    return () => {
      window.removeEventListener('pointerdown', onPress, true);
      clearTimeout(timer);
    };
  }, [bar, onClose]);

  // Bubbling, so an open menu inside closes first: its Escape is handled (default prevented) before it gets here.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.stopPropagation();
      onClose();
      if (returnFocusTo.current instanceof HTMLElement) {
        returnFocusTo.current.focus();
      }
    }
  };

  return (
    <Portal>
      {panel && <PanelOutline panel={panel} />}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the dialog */}
      <div
        ref={setFloating}
        style={floatingStyles}
        className={styles.card}
        role="dialog"
        aria-label={title}
        onKeyDown={onKeyDown}
        onPointerDownCapture={() => {
          pressedInside.current = true;
        }}
      >
        <div className={styles.header}>
          <Icon name={icon} />
          <span className={styles.title}>{title}</span>
          <IconButton name="times" size="sm" onClick={onClose} tooltip={t('dashboard.quick-edits.close', 'Close')} />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </Portal>
  );
}

/**
 * The panel's outline, drawn over it rather than styled onto it, as the panel's own classes change while the card is
 * open, e.g. as it is selected.
 */
function PanelOutline({ panel }: { panel: Element }) {
  const styles = useStyles2(getStyles);
  const outline = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = outline.current;
    if (!element) {
      return;
    }
    return autoUpdate(panel, element, () => {
      const { top, left, width, height } = panel.getBoundingClientRect();
      Object.assign(element.style, { top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` });
    });
  }, [panel]);

  return <div ref={outline} className={styles.panelOutline} data-testid="quick-edit-panel-outline" aria-hidden />;
}

const getStyles = (theme: GrafanaTheme2) => {
  const accent = theme.colors.accent.main;
  const clear = colorManipulator.alpha(accent, 0);
  // The ring keeps its two shadows when hidden, so the pulse can animate between the two lists.
  const restingShadow = `0 0 0 0 ${clear}, 0 0 0 0 ${clear}, ${theme.shadows.z3}`;
  const pulse = keyframes({
    from: {
      boxShadow: `0 0 0 2px ${accent}, 0 0 24px 6px ${colorManipulator.alpha(accent, 0.55)}, ${theme.shadows.z3}`,
    },
    to: { boxShadow: restingShadow },
  });

  return {
    card: css({
      zIndex: theme.zIndex.portal,
      width: 340,
      display: 'flex',
      flexDirection: 'column',
      // Above the panels, which share the primary background. In the light theme the elevated background is the same
      // white, so a stronger border keeps the card apart from them.
      background: theme.colors.background.elevated,
      border: `1px solid ${theme.isDark ? theme.colors.border.medium : theme.colors.border.strong}`,
      borderRadius: theme.shape.radius.lg,
      boxShadow: restingShadow,
      overflow: 'hidden',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${pulse} 700ms ease-out`,
      },
    }),
    // Solid, unlike the dashed outline of a selected element, in the accent of the open quick edit's button.
    panelOutline: css({
      position: 'fixed',
      zIndex: theme.zIndex.portal,
      pointerEvents: 'none',
      outline: `2px solid ${accent}`,
      outlineOffset: 2,
      borderRadius: theme.shape.radius.default,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 1, 1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.primary,
    }),
    title: css({
      flex: 1,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    body: css({
      padding: theme.spacing(2),
      overflowY: 'auto',
      // The full editor's fields, minus their trailing margin on the last one.
      '& > div > :last-child': { marginBottom: 0 },
    }),
  };
};
