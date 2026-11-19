import { css } from '@emotion/css';
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react';
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
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

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    zIndex: theme.zIndex.portal,
    width: 340,
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    boxShadow: theme.shadows.z3,
    overflow: 'hidden',
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
});
