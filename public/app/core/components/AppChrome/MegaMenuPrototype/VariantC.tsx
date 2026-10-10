// PROTOTYPE — throwaway. Variant C: the switcher opens a site map of every solution and its sections,
// shared sections collapse into an icon strip, and destinations open in a wide multi-column popout.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

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
  anchoredPosition,
  getStyles as getSharedStyles,
  isMock,
  useDismiss,
  usePopout,
} from './shared';
import { getDestinations, isActiveWithin, type SolutionNav } from './solutions';
import { setActiveSolution } from './state';

function Switcher({ nav, onPicked }: SwitcherProps) {
  const styles = useStyles2(getStyles);
  const shared = useStyles2(getSharedStyles);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(open, [buttonRef, panelRef], () => setOpen(false));

  const pick = (id: string) => {
    setActiveSolution(id);
    setOpen(false);
    onPicked();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Switch solution"
        aria-expanded={open}
        className={cx(shared.clusterButton, open && shared.clusterActive)}
        onClick={() => setOpen(!open)}
      >
        <Icon name="apps" size="lg" />
      </button>
      {open && (
        <Floating>
          <div ref={panelRef} className={styles.sheet} style={{ top: getChromeHeaderLevelHeight() }}>
            {nav.solutions.map((s) => (
              <div key={s.id} className={cx(styles.column, s.id === nav.activeSolution.id && styles.columnActive)}>
                <button type="button" className={styles.columnHeader} onClick={() => pick(s.id)}>
                  <Icon name={s.icon} size="lg" />
                  <span>
                    <div className={styles.columnName}>{s.name}</div>
                    <div className={styles.columnDesc}>{s.description}</div>
                  </span>
                </button>
                <ul className={shared.plainList}>
                  {s.sections.map((section) => (
                    <li key={section.id ?? section.text}>
                      <ItemLink item={section} onNavigate={() => pick(s.id)} className={styles.mapLink}>
                        <NavIcon item={section} size="sm" />
                        {section.text}
                        {isMock(section) && <span className={styles.mockDot} title="mock" />}
                      </ItemLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Floating>
      )}
    </>
  );
}

function SharedStrip({ nav, onNavigate }: BodyProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.strip}>
      {nav.shared.map((s) => (
        <Tooltip key={s.id ?? s.text} content={s.text} placement="bottom">
          <span>
            <ItemLink
              item={s}
              onNavigate={onNavigate}
              className={cx(styles.stripItem, isActiveWithin(s, nav.activeItem) && styles.stripItemActive)}
            >
              <NavIcon item={s} size="lg" />
              <span className={styles.stripLabel}>{s.text}</span>
            </ItemLink>
          </span>
        </Tooltip>
      ))}
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
  const styles = useStyles2(getStyles);
  const shared = useStyles2(getSharedStyles);
  const popout = usePopout();
  const openSection = sections.find(popout.isOpen);
  const navigate = () => {
    popout.close();
    onNavigate();
  };
  const columns = openSection && getDestinations(openSection).length > 6 ? 2 : 1;

  return (
    <>
      <ul className={shared.plainList}>
        {sections.map((s) => (
          <SectionRow
            key={s.id ?? s.text}
            compact
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
            className={styles.wide}
            style={{ ...anchoredPosition(popout.anchor, 8), width: columns === 2 ? 520 : 300 }}
          >
            <div className={styles.wideHeader}>
              <NavIcon item={openSection} size="lg" />
              <span>
                <div className={styles.columnName}>{openSection.text}</div>
                {openSection.subTitle && <div className={styles.columnDesc}>{openSection.subTitle}</div>}
              </span>
              <ItemLink item={openSection} onNavigate={navigate} className={styles.goTo}>
                Open <Icon name="arrow-right" />
              </ItemLink>
            </div>
            <DestinationList
              section={openSection}
              activeItem={nav.activeItem}
              onNavigate={navigate}
              columns={columns}
            />
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
      <SharedStrip nav={nav} onNavigate={onNavigate} />
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

export const VariantC: VariantImpl = { Switcher, Body, BottomSection };

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({ padding: theme.spacing(1) }),
  sheet: css({
    position: 'fixed',
    left: 0,
    right: 0,
    zIndex: theme.zIndex.portal,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: theme.spacing(2),
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: theme.spacing(2, 3),
    background: theme.colors.background.primary,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
  }),
  column: css({
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.lg,
    border: `1px solid transparent`,
  }),
  columnActive: css({ borderColor: theme.colors.primary.border, background: theme.colors.primary.transparent }),
  columnHeader: css({
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
  columnName: css({ fontWeight: theme.typography.fontWeightMedium }),
  columnDesc: css({ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }),
  mapLink: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1, 0.5, 2),
    color: theme.colors.text.secondary,
    '&:hover': { color: theme.colors.text.primary },
  }),
  mockDot: css({
    width: 6,
    height: 6,
    borderRadius: theme.shape.radius.circle,
    border: `1px dashed ${theme.colors.text.disabled}`,
  }),
  strip: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
    marginBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  stripItem: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1, 0.5),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    '&:hover': { background: theme.colors.action.hover, color: theme.colors.text.primary },
  }),
  stripItemActive: css({ background: theme.colors.action.selected, color: theme.colors.text.primary }),
  stripLabel: css({ fontSize: theme.typography.bodySmall.fontSize }),
  wide: css({
    position: 'fixed',
    zIndex: theme.zIndex.portal,
    maxHeight: '75vh',
    overflowY: 'auto',
    padding: theme.spacing(1.5),
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    boxShadow: theme.shadows.z3,
  }),
  wideHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5, 1, 1.5),
    marginBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  goTo: css({
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
