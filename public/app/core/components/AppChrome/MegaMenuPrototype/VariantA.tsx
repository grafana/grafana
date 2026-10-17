// PROTOTYPE — throwaway. Variant A: a tile-grid solution switcher, and a destination popout anchored
// beside the row that opened it.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import {
  type BodyProps,
  DestinationList,
  Floating,
  type SwitcherProps,
  type VariantImpl,
  SectionRow,
  anchoredPosition,
  getStyles as getSharedStyles,
  useDismiss,
  usePopout,
} from './shared';
import { type SolutionNav } from './solutions';
import { setActiveSolution } from './state';

function Switcher({ nav, onPicked }: SwitcherProps) {
  const styles = useStyles2(getStyles);
  const shared = useStyles2(getSharedStyles);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(open, [buttonRef, panelRef], () => setOpen(false));
  const rect = buttonRef.current?.getBoundingClientRect();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Switch solution"
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(shared.clusterButton, open && shared.clusterActive)}
        onClick={() => setOpen(!open)}
      >
        <Icon name="apps" size="lg" />
      </button>
      {open && rect && (
        <Floating>
          <div ref={panelRef} role="menu" className={styles.grid} style={{ top: rect.bottom + 6, left: rect.left }}>
            {nav.solutions.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={s.id === nav.activeSolution.id}
                className={cx(styles.tile, s.id === nav.activeSolution.id && styles.tileActive)}
                onClick={() => {
                  setActiveSolution(s.id);
                  setOpen(false);
                  onPicked();
                }}
              >
                <Icon name={s.icon} size="xl" />
                <span className={styles.tileName}>{s.name}</span>
                <span className={styles.tileDesc}>{s.description}</span>
              </button>
            ))}
          </div>
        </Floating>
      )}
    </>
  );
}

function SectionList({
  sections,
  nav,
  onNavigate,
}: {
  sections: NavModelItem[];
  nav: SolutionNav;
  onNavigate: () => void;
}) {
  const styles = useStyles2(getStyles);
  const shared = useStyles2(getSharedStyles);
  const popout = usePopout();
  const openSection = sections.find(popout.isOpen);
  const navigate = () => {
    popout.close();
    onNavigate();
  };

  return (
    <>
      <ul className={shared.plainList}>
        {sections.map((s) => (
          <SectionRow
            key={s.id ?? s.text}
            section={s}
            activeItem={nav.activeItem}
            onNavigate={navigate}
            open={popout.isOpen(s)}
            onToggle={popout.toggle(s)}
            arrowHover={popout.hover(s)}
          />
        ))}
      </ul>
      {openSection && popout.anchor && (
        <Floating>
          <div
            ref={popout.panelRef}
            {...popout.panelHoverProps}
            className={styles.popout}
            style={anchoredPosition(popout.anchor)}
          >
            <div className={styles.popoutTitle}>{openSection.text}</div>
            <DestinationList section={openSection} activeItem={nav.activeItem} onNavigate={navigate} />
          </div>
        </Floating>
      )}
    </>
  );
}

function Body({ nav, onNavigate }: BodyProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.body}>
      <SectionList sections={nav.shared} nav={nav} onNavigate={onNavigate} />
      <div className={styles.caption}>{nav.activeSolution.name}</div>
      <SectionList sections={nav.activeSolution.sections} nav={nav} onNavigate={onNavigate} />
    </div>
  );
}

function BottomSection({
  section,
  nav,
  onNavigate,
}: {
  section: NavModelItem;
  nav: SolutionNav;
  onNavigate: () => void;
}) {
  return <SectionList sections={[section]} nav={nav} onNavigate={onNavigate} />;
}

export const VariantA: VariantImpl = { Switcher, Body, BottomSection };

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({ padding: theme.spacing(1) }),
  caption: css({
    margin: theme.spacing(2, 1, 0.5),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }),
  grid: css({
    position: 'fixed',
    zIndex: theme.zIndex.portal,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 200px)',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    boxShadow: theme.shadows.z3,
  }),
  tile: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5),
    textAlign: 'left',
    border: `1px solid transparent`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    '&:hover': { borderColor: theme.colors.border.medium },
  }),
  tileActive: css({ borderColor: theme.colors.primary.border, background: theme.colors.primary.transparent }),
  tileName: css({ fontWeight: theme.typography.fontWeightMedium }),
  tileDesc: css({ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }),
  popout: css({
    position: 'fixed',
    zIndex: theme.zIndex.portal,
    width: 260,
    maxHeight: '70vh',
    overflowY: 'auto',
    padding: theme.spacing(1),
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    boxShadow: theme.shadows.z3,
  }),
  popoutTitle: css({
    padding: theme.spacing(0.5, 1.5, 1),
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
