/* eslint @grafana/no-untranslated-strings: 0 */
/* eslint @grafana/no-border-radius-literal: 0 */

import { css, cx } from '@emotion/css';
import { motion } from 'motion/react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Portal, useStyles2 } from '@grafana/ui';

import { tokens, hexToRgba } from './tokens';
import { CommandPaletteDividerItem, CommandPaletteItem } from './types';
import { useActiveIndex } from './useActiveIndex';
import { useActiveKeys } from './useActiveKeys';
import { useNavItems } from './useNavItems';
import { useRecentDashboards } from './useRecentDashboards';

// interface CommandPalette2Props {}

const PAGES_DIVIDER: CommandPaletteDividerItem = { type: 'divider', title: 'Pages' };
const DASH_DIVIDER: CommandPaletteDividerItem = { type: 'divider', title: 'Dashboards' };
const FAKE_DASH_ITEMS: CommandPaletteItem[] = [
  { type: 'result', title: 'Dashboards squad', icon: 'apps', parentTitle: 'UI experiments' },
  {
    type: 'result',
    title: 'Dashboard with adhoc filtering',
    icon: 'apps',
    parentTitle: 'Grafana Frontend Division',
  },
  { type: 'result', title: 'Cloud Logs Export Insights', icon: 'apps', parentTitle: 'GrafanaCloud' },
  {
    type: 'result',
    title: 'Usage Insights - 6 - Loki Query Fair Usage Drilldown',
    icon: 'apps',
    parentTitle: 'GrafanaCloud',
  },
  { type: 'result', title: 'USE Method / Node', icon: 'apps', parentTitle: 'Linux Node' },
];

const FAKE_BASE_ITEMS: CommandPaletteItem[] = [
  { type: 'divider', title: 'Folders' },
  { type: 'result', title: 'Dashboards squad', icon: 'folder-open', parentTitle: 'Grafana Frontend Division' },
];

export function CommandPalette2() {
  const styles = useStyles2(getStyles);
  const modKey = '⌘'; /*useMemo(() => getModKey(), []);*/
  const activeKeys = useActiveKeys();

  const recentDashboardItems = useRecentDashboards();
  const navItems = useNavItems();
  const [inputValue, setInputValue] = useState('');

  const items = useMemo(() => {
    return [...FAKE_BASE_ITEMS, DASH_DIVIDER, ...recentDashboardItems, ...FAKE_DASH_ITEMS, PAGES_DIVIDER, ...navItems];
  }, [navItems, recentDashboardItems]);

  const filteredItems = useMemo(() => {
    if (inputValue.length === 0) {
      return items;
    }

    return (
      items
        .filter((item) => {
          if (item.type === 'divider') {
            return true;
          }

          return (
            item.title.toLowerCase().includes(inputValue.toLowerCase()) ||
            item.subtitle?.toLowerCase().includes(inputValue.toLowerCase())
          );
        })
        // Filter out consecutive dividers
        .filter((item, index, all) => {
          const nextItem = all[index + 1];
          if (item.type === 'divider' && nextItem?.type === 'divider') {
            return false;
          }
          return true;
        })
    );
  }, [inputValue, items]);

  const activeIndex = useActiveIndex(filteredItems);
  const activeItemYPos = useMemo(() => {
    const itemsBefore = filteredItems.slice(0, activeIndex);
    const yPos = itemsBefore.reduce((acc, item) => {
      return acc + (item.type === 'divider' ? 18.85 : 54);
    }, 0);
    return yPos;
  }, [filteredItems, activeIndex]);

  const scrollingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollingRef.current) {
      return;
    }

    const itemsBefore = filteredItems.slice(0, Math.max(activeIndex - 2, 0));
    const yPos = itemsBefore.reduce((acc, item) => {
      return acc + (item.type === 'divider' ? 18.85 : 54);
    }, 0);

    scrollingRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
  }, [activeItemYPos, activeIndex, filteredItems]);

  return (
    <Portal>
      <motion.div
        initial={{ backgroundColor: `rgba(255, 255, 255, 0.0)` }}
        animate={{ backgroundColor: `rgba(255, 255, 255, 0.10)` }}
        className={styles.wrapper}
      >
        <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} className={styles.palette}>
          <div className={styles.inputBarCell}>
            <div className={styles.searchIcon}>
              <Icon name="search" size="lg" />
            </div>

            <input
              className={styles.searchInput}
              onChange={(ev) => setInputValue(ev.currentTarget.value)}
              value={inputValue}
              type="text"
              placeholder="Search for anything or type / for commands..."
            />

            <div className={styles.shortcut}>
              <div className={styles.shortcutKeys}>
                <span className={styles.keyboardKey}>{modKey}</span>
                <span className={styles.keyboardKey}>K</span>
              </div>
            </div>
          </div>

          <div className={styles.mainCell} ref={scrollingRef}>
            <motion.div
              transition={{ type: 'spring', duration: 0.45, bounce: 0.3 }}
              animate={{ y: activeItemYPos }}
              className={styles.highlightBg}
            />

            {filteredItems.map((item, idx) => {
              // const nextItem = filteredItems[idx + 1];
              // if (item.type === 'divider' && nextItem?.type === 'divider') {
              //   return null;
              // }

              if (item.type === 'divider') {
                return (
                  <div key={idx} className={styles.dividerItem}>
                    <div>{item.title}</div>
                    <div className={styles.dividerDivider} />
                  </div>
                );
              }

              return (
                <motion.div
                  key={idx}
                  className={styles.resultItem}
                  animate={{ color: idx === activeIndex ? '#FFFFFF' : '#C4C4CB' }}
                >
                  <motion.div animate={{ color: idx === activeIndex ? '#FFFFFF' : '#75757D' }}>
                    <Icon name={item.icon} />
                  </motion.div>
                  <div>{item.title}</div>
                  {item.parentTitle && (
                    <div>
                      {item.parentIcon && <Icon name={item.parentIcon} />} {item.parentTitle}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* <div className={styles.detailCell}>detail</div> */}

          <div className={styles.footerCell}>
            <div className={styles.shortcut}>
              <div className={styles.shortcutKeys}>
                <AnimatedKeyCap direction={-1} isActive={!!activeKeys.ArrowUp} className={styles.keyboardKey}>
                  <Icon name="arrow-up" />
                </AnimatedKeyCap>

                <AnimatedKeyCap direction={1} isActive={!!activeKeys.ArrowDown} className={styles.keyboardKey}>
                  <Icon name="arrow-down" />
                </AnimatedKeyCap>
              </div>
              <span className={styles.shortcutLabel}>to navigate</span>
            </div>

            <div className={styles.footerDivider} />

            <div className={styles.shortcut}>
              <span className={cx(styles.keyboardKey, styles.keyboardMultiKey)}>esc</span>
              <span className={styles.shortcutLabel}>
                Close <strong className={styles.shortcutEmphasis}>Launchpad</strong>
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      letterSpacing: '0',
      paddingInline: theme.spacing(6),
      // background: 'rgba(255, 255, 255, 0.10)',
      // backdropFilter: 'blur(2px)',
    }),

    palette: css({
      height: 'calc(100dvh - 64px)',
      maxHeight: 650,
      width: '100%',
      maxWidth: 1040,
      margin: '32px auto',
      overflow: 'hidden',
      borderRadius: 10,
      background: 'rgba(0, 0, 0, 0.80)',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      gridTemplateColumns: '1fr 1fr',
      backdropFilter: 'blur(100px)',
      boxShadow: [
        '0px 32px 32px -16px rgba(0, 0, 0, 0.15)',
        '0px 16px 16px -8px rgba(0, 0, 0, 0.15)',
        '0px 8px 8px -4px rgba(0, 0, 0, 0.15)',
        '0px 4px 4px -2px rgba(0, 0, 0, 0.15)',
        '0px 2px 2px -1px rgba(0, 0, 0, 0.15)',
        '0px 1px 1px 0px rgba(255, 255, 255, 0.10) inset',
      ].join(','),
      gridTemplateAreas: gt([
        // no prettier
        ['input', 'input'],
        ['main', 'main'],
        ['footer', 'footer'],
      ]),
    }),

    inputBarCell: css({
      paddingInline: theme.spacing(3),
      gridArea: 'input',
      background: hexToRgba(tokens.colors.black, 0.4),
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'stretch',
      gap: theme.spacing(2),
      backdropFilter: 'blur(2px)',
      height: 66,
      borderBottom: `1px solid ${hexToRgba(tokens.colors.grey[800], 0.8)}`,
    }),

    searchIcon: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: tokens.colors.grey[400],
    }),

    searchInput: css({
      all: 'unset',
      height: '100%',
      fontSize: 16,
      fontWeight: 400,
      color: tokens.colors.white,
      '&::placeholder': {
        color: tokens.colors.grey[500],
      },
    }),

    mainCell: css({
      position: 'relative',
      padding: theme.spacing(1, 3),
      gridArea: 'main',
      overflow: 'auto',
      // background: 'green',
    }),

    detailCell: css({
      padding: 8,
      gridArea: 'detail',
      // background: 'yellow',
    }),

    footerCell: css({
      padding: theme.spacing(2, 3),
      gridArea: 'footer',
      background: hexToRgba(tokens.colors.grey[800], 0.3),
      display: 'flex',
      gap: theme.spacing(2),
      backdropFilter: 'blur(2px)',
      borderTop: `1px solid ${tokens.colors.grey[800]}`,
    }),

    footerDivider: css({
      height: '100%',
      width: 1,
      background: tokens.colors.grey[800],
    }),

    shortcut: css({
      display: 'flex',
      alignItems: 'center',
      lineHeight: 1,
      gap: 8,
      pointerEvents: 'none',
    }),

    shortcutLabel: css({
      color: tokens.colors.grey[400],
    }),

    shortcutEmphasis: css({
      color: 'white',
      fontWeight: 500,
    }),

    shortcutKeys: css({
      display: 'flex',
      gap: 4,
    }),

    keyboardKey: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      borderRadius: 6,
      border: `1px solid #20202A`,
      color: '#9D9DAD',
      background: 'black',
      textAlign: 'center',
      fontSize: 13,
    }),

    keyboardMultiKey: css({
      width: 'unset',
      padding: '0 8px',
    }),

    resultItem: css({
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: theme.spacing(2),
      alignItems: 'center',
      padding: theme.spacing(2, 0),
      color: '#9898A4',
      fontSize: 14,
      position: 'relative',
      zIndex: 2,
    }),

    dividerItem: css({
      textTransform: 'uppercase',
      display: 'flex',
      gap: theme.spacing(3),
      alignItems: 'center',
      color: '#75757D',
      fontWeight: 500,
      fontSize: 12,
      position: 'relative',
      zIndex: 2,
      paddingBlock: `${theme.spacing(2)} ${theme.spacing(1)}`,
    }),

    dividerDivider: css({
      height: 1,
      width: '100%',
      background: 'rgba(44, 44, 57, 0.40)',
      flex: 1,
    }),

    highlightBg: css({
      position: 'absolute',
      top: 8, // should match padding on result cell
      height: 54,
      left: 8,
      right: 8,
      background: '#45454d4d',
      borderRadius: 6,
      zIndex: 1,
    }),
  };
};

const gt = (gridDef: Array<string | string[]>) => {
  return gridDef
    .map((row) => {
      const rowString = typeof row === 'string' ? row : row.join(' ');
      return `"${rowString}"`;
    })
    .join('\n');
};

function AnimatedKeyCap({
  isActive,
  className,
  children,
  direction,
}: {
  className: string;
  children: ReactNode;
  isActive: boolean;
  direction: number;
}) {
  return (
    <motion.span
      animate={{ color: isActive ? '#FFFFFF' : '#9D9DAD' }}
      transition={{ duration: 0.1 }}
      className={className}
    >
      <motion.span style={{ display: 'inline-block' }} animate={{ y: isActive ? 2 * direction : 0 }}>
        {children}
      </motion.span>
    </motion.span>
  );
}
