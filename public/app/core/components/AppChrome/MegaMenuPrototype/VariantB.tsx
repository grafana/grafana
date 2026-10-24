// PROTOTYPE — throwaway. Variant B: a vertical list switcher with the active solution named in the
// menu, and destinations in a full-height side panel next to the menu (with a filter).
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css, cx } from '@emotion/css';
import { type RefObject, useRef, useState } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Icon, IconButton, Input, useStyles2 } from '@grafana/ui';

import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

import {
  type BodyProps,
  DestinationList,
  Floating,
  ItemLink,
  NavIcon,
  type SwitcherProps,
  type VariantImpl,
  SectionRow,
  getStyles as getSharedStyles,
  menuRightEdge,
  useDismiss,
  usePopout,
} from './shared';
import { MORE_APPS_ID, type SolutionNav } from './solutions';
import { setActiveSolution } from './state';

function Switcher({ nav, onPicked }: SwitcherProps) {
  const styles = useStyles2(getStyles);
  const shared = useStyles2(getSharedStyles);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(open, [buttonRef, panelRef], () => setOpen(false));
  const rect = buttonRef.current?.getBoundingClientRect();

  const renderItem = (s: SolutionNav['solutions'][number]) => (
    <button
      key={s.id}
      type="button"
      role="menuitemradio"
      aria-checked={s.id === nav.activeSolution.id}
      className={styles.item}
      onClick={() => {
        setActiveSolution(s.id);
        setOpen(false);
        onPicked();
      }}
    >
      <Icon name={s.icon} />
      <span className={styles.itemText}>
        <span className={styles.itemName}>{s.name}</span>
        <span className={styles.itemDesc}>
          {s.description} · {s.sections.length} sections
        </span>
      </span>
      {s.id === nav.activeSolution.id && <Icon name="check" />}
    </button>
  );

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
          <div ref={panelRef} role="menu" className={styles.menu} style={{ top: rect.bottom + 6, left: rect.left }}>
            {nav.solutions.filter((s) => s.id !== MORE_APPS_ID).map(renderItem)}
            {nav.solutions.some((s) => s.id === MORE_APPS_ID) && (
              <>
                <hr className={styles.hr} />
                {nav.solutions.filter((s) => s.id === MORE_APPS_ID).map(renderItem)}
              </>
            )}
          </div>
        </Floating>
      )}
    </>
  );
}

function SidePanel({
  section,
  anchor,
  nav,
  onNavigate,
  onClose,
  panelRef,
  hoverProps,
  focusFilter,
}: {
  section: NavModelItem;
  anchor: HTMLElement;
  nav: SolutionNav;
  onNavigate: () => void;
  onClose: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  hoverProps: { onMouseEnter: () => void; onMouseLeave: () => void };
  focusFilter: boolean;
}) {
  const styles = useStyles2(getStyles);
  const [filter, setFilter] = useState('');
  const matches = (n: NavModelItem): boolean =>
    n.text.toLowerCase().includes(filter.toLowerCase()) || Boolean(n.children?.some(matches));
  const filtered: NavModelItem = filter
    ? {
        ...section,
        children: section.children
          ?.filter(matches)
          .map((c) =>
            c.text.toLowerCase().includes(filter.toLowerCase()) ? c : { ...c, children: c.children?.filter(matches) }
          ),
      }
    : section;

  return (
    <div
      ref={panelRef}
      {...hoverProps}
      className={styles.side}
      style={{ left: menuRightEdge(anchor), top: getChromeHeaderLevelHeight() }}
    >
      <div className={styles.sideHeader}>
        <NavIcon item={section} size="lg" />
        <ItemLink item={section} onNavigate={onNavigate} className={styles.sideTitle}>
          {section.text}
        </ItemLink>
        <IconButton name="times" aria-label="Close destinations" onClick={onClose} />
      </div>
      {section.subTitle && <div className={styles.sideSub}>{section.subTitle}</div>}
      <Input
        prefix={<Icon name="search" />}
        placeholder={`Filter ${section.text}`}
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
        // Only a click moves focus; hovering to peek must not steal it.
        autoFocus={focusFilter}
      />
      <div className={styles.sideList}>
        <DestinationList section={filtered} activeItem={nav.activeItem} onNavigate={onNavigate} />
      </div>
    </div>
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
          <SidePanel
            key={popout.openId}
            section={openSection}
            anchor={popout.anchor}
            nav={nav}
            onNavigate={navigate}
            onClose={popout.close}
            panelRef={popout.panelRef}
            hoverProps={popout.panelHoverProps}
            focusFilter={popout.pinned}
          />
        </Floating>
      )}
    </>
  );
}

function Body({ nav, onNavigate }: BodyProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.body}>
      <div className={styles.topSection}>
        <div className={styles.sharedLabel}>Everywhere</div>
        <SectionList sections={nav.shared} nav={nav} onNavigate={onNavigate} />
      </div>
      <div className={styles.solutionHeader}>
        <span className={styles.solutionIcon}>
          <Icon name={nav.activeSolution.icon} size="lg" />
        </span>
        <span>
          <div className={styles.solutionName}>{nav.activeSolution.name}</div>
          <div className={styles.itemDesc}>{nav.activeSolution.description}</div>
        </span>
      </div>
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

export const VariantB: VariantImpl = { Switcher, Body, BottomSection };

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({ padding: theme.spacing(1) }),
  menu: css({
    position: 'fixed',
    zIndex: theme.zIndex.portal,
    width: 320,
    padding: theme.spacing(0.5),
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  item: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    width: '100%',
    padding: theme.spacing(1),
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    color: theme.colors.text.primary,
    borderRadius: theme.shape.radius.default,
    '&:hover': { background: theme.colors.action.hover },
  }),
  itemText: css({ display: 'flex', flexDirection: 'column', flex: 1 }),
  itemName: css({ fontWeight: theme.typography.fontWeightMedium }),
  itemDesc: css({ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }),
  hr: css({ margin: theme.spacing(0.5, 0), borderColor: theme.colors.border.weak }),
  topSection: css({
    paddingBottom: theme.spacing(1),
    marginBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  solutionHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1, 1.5),
    marginBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  solutionIcon: css({
    display: 'inline-flex',
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.primary.transparent,
    color: theme.colors.primary.text,
  }),
  solutionName: css({ fontSize: theme.typography.h5.fontSize, fontWeight: theme.typography.fontWeightMedium }),
  sharedLabel: css({
    margin: theme.spacing(0.5, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  side: css({
    position: 'fixed',
    bottom: 0,
    zIndex: theme.zIndex.portal,
    width: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    background: theme.colors.background.primary,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
    borderRight: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
  }),
  sideHeader: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }),
  sideTitle: css({ flex: 1, fontSize: theme.typography.h5.fontSize, fontWeight: theme.typography.fontWeightMedium }),
  sideSub: css({ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }),
  sideList: css({ overflowY: 'auto', flex: 1 }),
});
