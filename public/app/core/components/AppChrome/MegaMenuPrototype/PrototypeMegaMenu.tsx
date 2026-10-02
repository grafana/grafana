// PROTOTYPE — throwaway. Three variants of the solutions mega menu, on every page, switchable via
// `?navPrototype=A|B|C|off` and the floating bar at the bottom of the screen.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { type DOMAttributes } from '@react-types/shared';
import { forwardRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, ScrollContainer, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { MegaMenu, MENU_WIDTH } from '../MegaMenu/MegaMenu';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';
import { BottomCluster, HeaderCluster, type VariantImpl } from './shared';
import { useSolutionNav } from './solutions';
import {
  type PrototypeVariant,
  VARIANTS,
  VARIANT_NAMES,
  activeSolutionStore,
  cancelHoverClose,
  scheduleHoverClose,
  setActiveSolution,
  setPrototypeVariant,
  stickHoverOpen,
  usePrototypeVariant,
} from './state';

const IMPLS: Record<PrototypeVariant, VariantImpl> = { A: VariantA, B: VariantB, C: VariantC };

interface Props extends DOMAttributes {
  onClose: () => void;
  className?: string;
}

/** Drop-in for MegaMenu: renders the prototype when a variant is active, the real menu otherwise. */
export const MegaMenuOrPrototype = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const variant = usePrototypeVariant();
  return variant ? <PrototypeMegaMenu {...props} variant={variant} ref={ref} /> : <MegaMenu {...props} ref={ref} />;
});
MegaMenuOrPrototype.displayName = 'MegaMenuOrPrototype';

const PrototypeMegaMenu = forwardRef<HTMLDivElement, Props & { variant: PrototypeVariant }>(
  ({ onClose, variant, className, ...restProps }, ref) => {
    const styles = useStyles2(getStyles);
    const { chrome } = useGrafana();
    const state = chrome.useState();
    const nav = useSolutionNav();
    const impl = IMPLS[variant];
    const { Body } = impl;
    const onNavigate = state.megaMenuDocked ? () => {} : onClose;

    return (
      <div
        {...restProps}
        ref={ref}
        className={className}
        data-testid={selectors.components.NavMenu.Menu}
        data-proto-menu
        onMouseEnter={cancelHoverClose}
        onMouseLeave={() => scheduleHoverClose(chrome)}
        onMouseDownCapture={stickHoverOpen}
      >
        {state.megaMenuDocked && (
          <div className={styles.header}>
            <HeaderCluster impl={impl} nav={nav} placement="menu" />
          </div>
        )}
        <nav className={styles.content} aria-label="Navigation">
          <div className={styles.scroll}>
            <ScrollContainer height="100%" overflowX="hidden">
              <Body nav={nav} onNavigate={onNavigate} />
            </ScrollContainer>
          </div>
          <BottomCluster impl={impl} nav={nav} onNavigate={onNavigate} />
        </nav>
      </div>
    );
  }
);
PrototypeMegaMenu.displayName = 'PrototypeMegaMenu';

/** Replaces the logo + hamburger in the top bar while a variant is active. */
export function PrototypeTopBarCluster() {
  const variant = usePrototypeVariant();
  const nav = useSolutionNav();
  return variant ? <HeaderCluster impl={IMPLS[variant]} nav={nav} placement="topbar" /> : null;
}

/** The active solution follows the page: landing on a page owned by another solution switches to it. */
function AutoSwitchSolution() {
  const { pathname } = useLocation();
  const { owningSolutionId } = useSolutionNav();
  useEffect(() => {
    if (owningSolutionId && owningSolutionId !== activeSolutionStore.get()) {
      setActiveSolution(owningSolutionId);
    }
  }, [pathname, owningSolutionId]);
  return null;
}

const CYCLE: Array<PrototypeVariant | 'off'> = ['off', ...VARIANTS];

export function PrototypeVariantBar() {
  const styles = useStyles2(getStyles);
  const variant = usePrototypeVariant() ?? 'off';
  const index = CYCLE.indexOf(variant);
  const go = (delta: number) => setPrototypeVariant(CYCLE[(index + delta + CYCLE.length) % CYCLE.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        el.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
      ) {
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        go(-1);
      } else if (e.altKey && e.key === 'ArrowRight') {
        go(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <>
      {variant !== 'off' && <AutoSwitchSolution />}
      <div className={styles.bar} title="Prototype switcher (Alt + ← / →)">
        <IconButton name="angle-left" aria-label="Previous variant" onClick={() => go(-1)} />
        <span className={styles.barLabel}>
          {variant === 'off' ? 'Current menu' : `${variant} (${VARIANT_NAMES[variant]})`}
        </span>
        <IconButton name="angle-right" aria-label="Next variant" onClick={() => go(1)} />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    alignItems: 'center',
    height: getChromeHeaderLevelHeight(),
    padding: theme.spacing(0, 1),
    flexShrink: 0,
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 0,
    width: MENU_WIDTH,
  }),
  scroll: css({ flex: 1, minHeight: 0 }),
  bar: css({
    position: 'fixed',
    bottom: theme.spacing(2),
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.portal + 10,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.pill,
    background: '#111',
    color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    '& button': { color: '#fff' },
  }),
  barLabel: css({ minWidth: 260, textAlign: 'center' }),
});
