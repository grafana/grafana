import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { mergeProps } from '@react-aria/utils';
import {
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { EmptyState, Icon, Portal, Spinner, useStyles2 } from '@grafana/ui';

import { CmdkResultItem } from './CmdkResultItem';
import { useCmdkSources } from './registry';
import { matchesShortcut } from './shortcuts';
import { type CmdkAction, type CmdkItem, type CmdkSource } from './types';
import { useCmdkResults } from './useCmdkResults';
import { closeCmdk, toggleCmdk, useCmdkVisible } from './visibility';

const LIST_DOM_ID = 'cmdk-results';

function itemDomId(item: CmdkItem) {
  return `cmdk-item-${item.id}`;
}

/**
 * The new command palette. Rendered permanently in the app chrome; opens on mod+k or through openCmdk/toggleCmdk.
 */
export function Cmdk() {
  const visible = useCmdkVisible();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, 'mod+k')) {
        event.preventDefault();
        toggleCmdk();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Portal>
      <CmdkModal />
    </Portal>
  );
}

/**
 * Split out so all palette state (query, subscope stack, highlight) resets by unmounting when the palette closes.
 */
function CmdkModal() {
  const styles = useStyles2(getStyles);
  const registeredSources = useCmdkSources();
  const [subscopeStack, setSubscopeStack] = useState<CmdkSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Only the last source in the subscope stack is queried; without a subscope all registered sources are.
  const activeSources = useMemo(
    () => (subscopeStack.length > 0 ? subscopeStack.slice(-1) : registeredSources),
    [subscopeStack, registeredSources]
  );

  // Bumped by keepOpen actions and source headers to re-query the active sources with the same query.
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  const sectionResults = useCmdkResults(activeSources, searchQuery, refreshToken);
  const flatItems = useMemo(() => sectionResults.flatMap((sectionResult) => sectionResult.items), [sectionResults]);

  // Keep the highlight on a valid row when results change without eagerly resetting state.
  const clampedIndex = Math.min(activeIndex, Math.max(flatItems.length - 1, 0));
  const activeItem: CmdkItem | undefined = flatItems[clampedIndex];

  const ref = useRef<HTMLDivElement | null>(null);
  const { overlayProps } = useOverlay({ isOpen: true, isDismissable: true, onClose: closeCmdk }, ref);
  const { dialogProps } = useDialog({}, ref);

  const pushSubscope = (scope: CmdkSource) => {
    setSubscopeStack((stack) => [...stack, scope]);
    setSearchQuery('');
    setActiveIndex(0);
  };

  const selectItem = (item: CmdkItem) => {
    switch (item.type) {
      case 'action':
        item.action();
        if (item.keepOpen) {
          refresh();
        } else {
          closeCmdk();
        }
        break;
      case 'navigation':
        if (item.target === '_blank') {
          window.open(item.href, '_blank', 'noreferrer');
        } else if (/^https?:\/\//.test(item.href)) {
          window.location.assign(item.href);
        } else {
          locationService.push(item.href);
        }
        closeCmdk();
        break;
      case 'subscope':
        pushSubscope(item.getScope());
        break;
    }
  };

  const runAdditionalAction = (action: CmdkAction) => {
    if (action.type === 'subscope') {
      pushSubscope(action.getScope());
    } else {
      action.action();
      if (action.keepOpen) {
        refresh();
      }
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatItems.length === 0) {
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(Math.min(Math.max(clampedIndex + delta, 0), flatItems.length - 1));
      return;
    }
    // Additional action shortcuts (like shift+enter) must win over the plain Enter selection below.
    const matchedAction = activeItem?.additionalActions?.find((action) => matchesShortcut(event, action.shortcut));
    if (matchedAction) {
      event.preventDefault();
      runAdditionalAction(matchedAction);
      return;
    }
    if (matchesShortcut(event, 'enter') && activeItem) {
      event.preventDefault();
      selectItem(activeItem);
      return;
    }
    if (event.key === 'Backspace' && searchQuery === '' && subscopeStack.length > 0) {
      event.preventDefault();
      setSubscopeStack((stack) => stack.slice(0, -1));
      setActiveIndex(0);
    }
  };

  const detail = activeItem?.renderDetail?.();

  return (
    <div className={styles.positioner}>
      <FocusScope contain autoFocus restoreFocus>
        <div {...mergeProps(overlayProps, dialogProps, { onKeyDown })} ref={ref} className={styles.panel}>
          <div className={styles.searchContainer}>
            <Icon name="search" size="md" className={styles.searchIcon} />
            {subscopeStack.map(
              (source, index) =>
                source.subscopeName && (
                  <span key={index} className={styles.scopePill}>
                    {source.subscopeName}
                  </span>
                )
            )}
            <input
              className={styles.search}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.currentTarget.value);
                setActiveIndex(0);
              }}
              placeholder={t('cmdk.search.placeholder', 'Search or jump to...')}
              spellCheck={false}
              role="combobox"
              aria-expanded
              aria-controls={LIST_DOM_ID}
              aria-activedescendant={activeItem ? itemDomId(activeItem) : undefined}
            />
          </div>
          {registeredSources.map((source, index) =>
            source.renderHeader ? <Fragment key={index}>{source.renderHeader({ refresh })}</Fragment> : null
          )}
          <div className={styles.columns}>
            <div className={styles.results} role="listbox" id={LIST_DOM_ID}>
              {sectionResults.length === 0 && (
                <EmptyState variant="not-found" message={t('cmdk.empty-state.message', 'No results found')} />
              )}
              {sectionResults.map(({ section, items, loading }) => (
                <Fragment key={section.id}>
                  <div className={styles.sectionHeader}>
                    {section.title}
                    {loading && <Spinner size="xs" inline />}
                  </div>
                  {items.map((item) => (
                    <CmdkResultItem
                      key={item.id}
                      item={item}
                      id={itemDomId(item)}
                      active={item === activeItem}
                      onSelect={selectItem}
                      onAdditionalAction={runAdditionalAction}
                      onActivate={() => setActiveIndex(flatItems.indexOf(item))}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
            {detail && <div className={styles.detail}>{detail}</div>}
          </div>
        </div>
      </FocusScope>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    positioner: css({
      position: 'fixed',
      inset: 0,
      zIndex: theme.zIndex.portal,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: theme.spacing(0.5),
      background: theme.components.overlay.background,
    }),
    panel: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.md,
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      borderRadius: theme.shape.radius.lg,
      border: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
      boxShadow: theme.shadows.z3,
    }),
    searchContainer: css({
      alignItems: 'center',
      background: theme.components.input.background,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      padding: theme.spacing(1, 2),
      position: 'relative',
    }),
    searchIcon: css({
      marginRight: theme.spacing(1),
    }),
    scopePill: css({
      ...theme.typography.bodySmall,
      fontWeight: theme.typography.fontWeightMedium,
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.5),
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      marginRight: theme.spacing(0.5),
    }),
    search: css({
      fontSize: theme.typography.fontSize,
      width: '100%',
      boxSizing: 'border-box',
      outline: 'none',
      border: 'none',
      background: 'transparent',
      color: theme.components.input.text,
    }),
    columns: css({
      display: 'flex',
      alignItems: 'stretch',
    }),
    results: css({
      flexGrow: 1,
      minWidth: 0,
      maxHeight: 650,
      overflowY: 'auto',
      paddingBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1.5, 2, 1, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
    detail: css({
      flex: '0 0 50%',
      minWidth: 0,
      maxHeight: 650,
      overflowY: 'auto',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
      // The palette is capped at the md breakpoint width — too narrow for a second column on small screens.
      [theme.breakpoints.down('lg')]: {
        display: 'none',
      },
    }),
  };
};
