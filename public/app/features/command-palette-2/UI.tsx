/* eslint @grafana/no-untranslated-strings: 0 */
/* eslint @grafana/no-border-radius-literal: 0 */
/* eslint @grafana/no-unreduced-motion: 0 */

import { css, cx } from '@emotion/css';
import { AnimatePresence, motion } from 'motion/react';
import { ChangeEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Portal, Stack, useStyles2 } from '@grafana/ui';

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

const COMMAND_ITEMS: CommandPaletteItem[] = [
  { type: 'divider', title: 'Page commands' },
  { type: 'result', icon: 'monitor', title: 'Edit mode', parentTitle: 'Dashboard' },
  { type: 'result', icon: 'monitor', title: 'Collapse all rows', parentTitle: 'Dashboard' },
  { type: 'result', icon: 'monitor', title: 'Add panel', parentTitle: 'Dashboard' },
  { type: 'result', icon: 'monitor', title: 'Add row', parentTitle: 'Dashboard' },
  { type: 'result', icon: 'monitor', title: 'Attach to Incident', parentTitle: 'Incident' },

  { type: 'divider', title: 'Global commands' },
  { type: 'result', icon: 'globe', title: 'Create new dashboard', parentTitle: 'Dashboard' },
  { type: 'result', icon: 'globe', title: 'Import dashboard', parentTitle: 'Dashboard' },
  { type: 'result', icon: 'globe', title: 'Raise new Incident', parentTitle: 'Incident' },
  { type: 'result', icon: 'globe', title: 'Add', parentTitle: 'Incident' },
  { type: 'result', icon: 'globe', title: 'Create new alert rule', parentTitle: 'Alert' },
  { type: 'result', icon: 'globe', title: 'Set Light theme', parentTitle: 'Theme' },
];

export function CommandPalette2() {
  const styles = useStyles2(getStyles);
  const modKey = '⌘'; /*useMemo(() => getModKey(), []);*/
  const activeKeys = useActiveKeys();

  const [mode, setMode] = useState<'search' | 'command'>('search');

  const recentDashboardItems = useRecentDashboards();
  const navItems = useNavItems();
  const [inputValue, setInputValue] = useState('');

  const handleInput = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    const newValue = ev.currentTarget.value;

    // If the user has typed just "/", switch over to 'command mode'
    if (newValue === '/') {
      setMode('command');
      setInputValue('');
    } else {
      setInputValue(newValue);
    }
  }, []);

  const handleBackButtonClick = useCallback(() => {
    setMode('search');
    setInputValue('');
  }, []);

  useEffect(() => {
    function handler(ev: KeyboardEvent) {
      if (ev.key === 'Backspace' && inputValue.length === 0 && mode === 'command') {
        setInputValue('');
        setMode('search');
      }
    }

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [mode, inputValue]);

  const items = useMemo(() => {
    return mode === 'search'
      ? [...FAKE_BASE_ITEMS, DASH_DIVIDER, ...recentDashboardItems, ...FAKE_DASH_ITEMS, PAGES_DIVIDER, ...navItems]
      : COMMAND_ITEMS;
  }, [mode, navItems, recentDashboardItems]);

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
          if (item.type === 'divider' && (nextItem?.type === 'divider' || !nextItem)) {
            return false;
          }
          return true;
        })
    );
  }, [inputValue, items]);

  const activeIndex = useActiveIndex(filteredItems);
  const activeItemYPos = useMemo(() => {
    const itemsBefore = filteredItems.slice(0, activeIndex);
    return calcHeightForRows(itemsBefore);
  }, [filteredItems, activeIndex]);

  const scrollingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the view to the active item
    if (!scrollingRef.current) {
      return;
    }

    const itemsBefore = filteredItems.slice(0, Math.max(activeIndex - 2, 0));
    const yPos = calcHeightForRows(itemsBefore);
    scrollingRef.current.scrollTo({ top: yPos, behavior: 'smooth' });
  }, [activeItemYPos, activeIndex, filteredItems]);

  const variants = {
    in: { y: 50, opacity: 1, maxHeight: 650, transition: { duration: 0.2 } },
    expanded: { y: 0, opacity: 1, maxHeight: 700, transition: { duration: 0.2 } },
    out: { y: 70, opacity: 0, maxHeight: 650, transition: { duration: 0.2, delay: 0.5 } },
  };
  const breadcrumbs = ['Home'];
  if (mode === 'command') {
    breadcrumbs.push('Commands');
  }

  return (
    <Portal>
      <motion.div
        initial={{ backgroundColor: `rgba(255, 255, 255, 0.0)` }}
        animate={{ backgroundColor: `rgba(255, 255, 255, 0.10)` }}
        className={styles.wrapper}
      >
        <motion.div
          layout
          initial={'out'}
          animate={mode === 'command' ? 'expanded' : 'in'}
          variants={variants}
          className={styles.palette}
        >
          <div className={styles.navWrapper}>
            <AnimatePresence>
              {mode === 'command' && (
                <motion.div
                  layout
                  initial={{ height: 0, borderBottomColor: hexToRgba(tokens.colors.grey[800], 0.5) }}
                  animate={{ height: 50, borderBottomColor: hexToRgba(tokens.colors.grey[800], 0.5) }}
                  exit={{ height: 0, borderBottomColor: hexToRgba(tokens.colors.grey[800], 0.5) }}
                  transition={{ duration: 0.2 }}
                  className={styles.nav}
                >
                  <motion.button
                    className={styles.navClose}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2 }}
                    onClick={handleBackButtonClick}
                  >
                    <Icon className={styles.navCloseIcon} name="arrow-left" />
                  </motion.button>
                  <ul className={styles.breadcrumbs}>
                    {breadcrumbs.map((crumb, idx) => (
                      <motion.li
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: 0.05 * (idx + 1), duration: 0.2 } }}
                        exit={{ opacity: 0, x: -4, transition: { duration: 0.1 } }}
                        className={styles.breadcrumb}
                        key={idx}
                      >
                        {crumb}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className={styles.inputBarCell}>
            <div className={styles.searchIcon}>
              <AnimatePresence>
                {mode === 'search' ? (
                  <motion.div
                    // layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.2 } }}
                    exit={{ opacity: 0, transition: { delay: 0 } }}
                    transition={{ duration: 0.2 }}
                    className={styles.commandIcon}
                    key={mode}
                  >
                    <Icon
                      style={{
                        width: 12,
                        height: 12,
                        overflow: 'hidden',
                      }}
                      name="search"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    // layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: 0.2, duration: 0.2 } }}
                    exit={{ opacity: 0, x: 20, transition: { delay: 0 } }}
                    transition={{ duration: 0.2 }}
                    className={styles.commandIcon}
                    key={mode}
                  >
                    /
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input
              className={styles.searchInput}
              onChange={handleInput}
              value={inputValue}
              type="text"
              placeholder={mode === 'search' ? 'Search for anything or type / for commands...' : 'Search commands...'}
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
              transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
              animate={{ y: activeItemYPos }}
              className={styles.highlightBg}
            />

            <AnimatePresence mode="wait">
              {filteredItems.map((item, idx) => {
                // const nextItem = filteredItems[idx + 1];
                // if (item.type === 'divider' && nextItem?.type === 'divider') {
                //   return null;
                // }

                // Framer Motion requires a unique key to trigger a re-render
                const longId = `${item.type}-${item.title}-${idx}`;

                const dividerVariants = {
                  in: {
                    opacity: 1,
                    y: 0,
                    color: hexToRgba(tokens.colors.grey[500], 0.8),
                    transition: { duration: 0.2, delay: 0.03 * idx },
                  },
                  active: { opacity: 1, y: 0, color: '#FFFFFF', transition: { duration: 0.2, delay: 0.03 * idx } },
                  out: { opacity: 0, y: 20, transition: { duration: 0.2, delay: 0.03 * idx } },
                };

                if (item.type === 'divider') {
                  return (
                    <motion.div
                      key={longId}
                      initial={'out'}
                      animate={longId === `${item.type}-${item.title}-${activeIndex}` ? 'active' : 'in'}
                      variants={dividerVariants}
                      className={styles.dividerItem}
                    >
                      <div>{item.title}</div>
                      <div className={styles.dividerDivider} />
                    </motion.div>
                  );
                }

                const variants = {
                  in: {
                    opacity: 1,
                    y: 0,
                    color: tokens.colors.grey[400],
                    transition: { duration: 0.2, delay: 0.03 * idx },
                  },
                  active: { opacity: 1, y: 0, color: '#FFFFFF', transition: { duration: 0.2, delay: 0.03 * idx } },
                  out: { opacity: 0, y: 20, transition: { duration: 0.2, delay: 0.03 * idx } },
                };

                const icon = (
                  <motion.div
                    animate={{ color: longId === `${item.type}-${item.title}-${activeIndex}` ? '#FFFFFF' : '#75757D' }}
                  >
                    <Icon name={item.icon} />
                  </motion.div>
                );

                let body: ReactNode = null;

                if (mode === 'search') {
                  // search mode
                  body = (
                    <>
                      <div className={styles.commandIconWrapper}>{icon}</div>
                      <div className={styles.resultItemMain}>{item.title}</div>
                      {item.parentTitle && (
                        <div className={styles.parentTitle}>
                          {item.parentIcon && <Icon name={item.parentIcon} />} {item.parentTitle}
                        </div>
                      )}
                    </>
                  );
                } else {
                  // command mode
                  body = (
                    <>
                      <div className={styles.commandIconWrapper}>{icon}</div>
                      <Stack gap={0.5} alignItems="center">
                        {item.parentTitle && (
                          <>
                            <div className={styles.commandParentWrapper}>
                              <div className={styles.commandParent}>{item.parentTitle}</div>
                            </div>
                            <Icon name="angle-right" className={styles.commandParentIcon} />
                          </>
                        )}
                        <div>{item.title}</div>
                      </Stack>
                    </>
                  );
                }

                return (
                  <motion.div
                    key={longId}
                    className={cx(styles.resultItem, mode === 'command' && styles.commandItem)}
                    // animate={{ color: idx === activeIndex ? '#FFFFFF' : '#C4C4CB' }}
                    // animate={idx === activeIndex ? 'active' : 'in'}
                    initial={'out'}
                    animate={longId === `${item.type}-${item.title}-${activeIndex}` ? 'active' : 'in'}
                    variants={variants}
                  >
                    {body}
                  </motion.div>
                );
              })}
            </AnimatePresence>
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

function calcHeightForRows(items: CommandPaletteItem[]) {
  return items.reduce((acc, item) => {
    return acc + (item.type === 'divider' ? DIVIDER_HEIGHT : RESULT_HEIGHT);
  }, 0);
}

const DIVIDER_HEIGHT = 42.85;
const RESULT_HEIGHT = 54;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'wrapper',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      letterSpacing: 'initial',
      padding: theme.spacing(3),
    }),

    palette: css({
      label: 'palette',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 650,
      height: '100%',
      width: '100%',
      maxWidth: 1040,
      marginInline: 'auto',
      overflow: 'hidden',
      borderRadius: 10,
      background: 'rgba(0, 0, 0, 0.80)',
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
    }),

    // commandMode: css({
    //   marginTop: 32,
    //   height: 'calc((100dvh - 64px) + 51px)',
    //   maxHeight: 650 + 51,
    // }),

    // searchMode: css({
    //   marginTop: 51 + 32,
    //   height: 'calc(100dvh - 64px)',
    //   maxHeight: 650,
    // }),

    navBarCell: css({
      label: 'navBar',
      padding: theme.spacing(1.5, 3),
      display: 'flex',
      borderBottom: '1px solid #202027',
      color: tokens.colors.grey[400],
    }),

    lastCrumb: css({
      color: tokens.colors.grey[200],
    }),

    navWrapper: css({
      gridArea: 'nav',
      // height: 50,
      display: 'block',
      fontSize: 14,
      position: 'relative',
      zIndex: 1000,
    }),

    nav: css({
      color: tokens.colors.grey[400],
      background: hexToRgba(tokens.colors.grey[950], 0.8),
      paddingInline: theme.spacing(3),
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      alignItems: 'center',
      display: 'flex',
      overflow: 'hidden',
      borderBottom: `1px solid transparent`,
    }),

    navClose: css({
      all: 'unset',
      width: 26,
      height: 26,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: tokens.colors.grey[800],
      color: tokens.colors.grey[300],
      borderRadius: 6,
      cursor: 'pointer',
      boxShadow: [
        '0px 8px 8px -4px rgba(0, 0, 0, 0.15)',
        '0px 4px 4px -2px rgba(0, 0, 0, 0.15)',
        '0px 2px 2px -1px rgba(0, 0, 0, 0.15)',
        '0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset',
        '0px 0px 0px 1px rgba(255, 255, 255, 0.05) inset',
        '0px 0px 0px 0.5px rgba(0, 0, 0, 0.25)',
      ].join(','),
      '&:hover': {
        background: tokens.colors.grey[700],
        svg: {
          transform: 'translateX(-2px)',
        },
      },
    }),

    navCloseIcon: css({
      transition: '200ms ease-in-out all',
    }),

    breadcrumbs: css({
      display: 'flex',
      gap: theme.spacing(3),
      listStyle: 'none',
      padding: 0,
      marginLeft: 16,
    }),

    breadcrumb: css({
      position: 'relative',
      color: tokens.colors.grey[300],
      '&::before': {
        content: '"/"',
        position: 'absolute',
        left: -14,
        color: tokens.colors.grey[400],
      },
      '&:first-child::before': {
        content: 'none',
      },
      '&:last-child': {
        color: tokens.colors.white,
        fontWeight: 500,
      },
    }),

    inputBarCell: css({
      label: 'inputBar',
      flex: '0 0 auto',
      paddingInline: theme.spacing(3),
      background: hexToRgba(tokens.colors.black, 0.4),
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'stretch',
      gap: theme.spacing(2),
      backdropFilter: 'blur(2px)',
      height: 66,
      borderBottom: `1px solid ${hexToRgba(tokens.colors.grey[800], 0.5)}`,
    }),

    searchIcon: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: tokens.colors.grey[400],
      width: 26,
    }),

    commandIcon: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: tokens.colors.grey[200],
      borderRadius: 6,
      border: `1px solid ${hexToRgba(tokens.colors.grey[700], 0.7)}`,
      height: 24,
      width: 24,
      marginLeft: 1,
      overflow: 'hidden',
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
      label: 'main',
      position: 'relative',
      padding: theme.spacing(1, 3),
      overflow: 'auto',
      flex: '1 1 100%',
    }),

    detailCell: css({
      label: 'detail',
      padding: 8,
    }),

    footerCell: css({
      label: 'footer',
      padding: theme.spacing(2, 3),
      background: hexToRgba(tokens.colors.grey[800], 0.3),
      display: 'flex',
      gap: theme.spacing(2),
      backdropFilter: 'blur(2px)',
      borderTop: `1px solid ${hexToRgba(tokens.colors.grey[800], 0.5)}`,
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
      display: 'flex',
      gap: theme.spacing(1.5),
      alignItems: 'center',
      padding: '14px 0',
      color: '#9898A4',
      fontSize: 14,
      position: 'relative',
      zIndex: 2,
    }),

    commandItem: css({
      padding: '14px 0px',
      display: 'flex',
      alignItems: 'center',
    }),

    resultItemMain: css({
      flexGrow: 1,
    }),

    parentTitle: css({
      color: tokens.colors.grey[500],
    }),

    dividerItem: css({
      textTransform: 'uppercase',
      display: 'flex',
      letterSpacing: 0.5,
      gap: theme.spacing(3),
      alignItems: 'center',
      color: tokens.colors.grey[500],
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

    commandParentWrapper: css({
      width: 80,
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginLeft: 4,
    }),

    commandParent: css({
      padding: '2px 6px 1px 6px',
      borderRadius: 6,
      border: `1px solid ${hexToRgba(tokens.colors.grey[700], 0.7)}`,
      background: hexToRgba(tokens.colors.grey[800], 0.8),
      color: tokens.colors.grey[200],
      fontSize: 12,
      boxShadow: [
        '0px 4px 4px -2px rgba(0, 0, 0, 0.15)',
        '0px 2px 2px -1px rgba(0, 0, 0, 0.15)',
        // '0px 1px 1px 0px rgba(255, 255, 255, 0.10) inset',
      ].join(','),
    }),

    commandIconWrapper: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 26,
      height: 26,
      borderRadius: 6,
      background: hexToRgba(tokens.colors.white, 0.05),
    }),

    commandParentIcon: css({
      color: tokens.colors.grey[500],
    }),

    button: css({
      all: 'unset',
      lineHeight: 1,
      color: '#D9D9D9',
      border: `1px solid ${tokens.colors.grey[700]}`,
      background: tokens.colors.grey[800],
      borderRadius: 6,
      padding: 3,
      cursor: 'pointer',
      transition: '200ms ease-in-out all',
      boxShadow: `0px -4px 11px -3px rgba(0, 0, 0, 0.10) inset, 0px 8px 8px -4px rgba(0, 0, 0, 0.05), 0px 4px 4px -2px rgba(0, 0, 0, 0.10), 0px 2px 2px -1px rgba(0, 0, 0, 0.10), 0px 1px 1px -0.5px rgba(0, 0, 0, 0.10)`,

      ['&:hover']: {
        borderColor: tokens.colors.grey[600],
        background: tokens.colors.grey[700],
      },
    }),
  };
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
