import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';
import { useEffect, useRef } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';
import { useLocation } from 'react-router-dom-v5-compat';
import { useLocalStorage } from 'react-use';

import { FeatureState, type GrafanaTheme2, type NavModelItem, toIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2, Text, IconButton, Icon, Stack, FeatureBadge, Box, ErrorBoundaryAlert } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';
import { ScopesDashboards } from 'app/features/scopes/dashboards/ScopesDashboards';

import { Indent } from '../../Indent/Indent';

import { MegaMenuItemText } from './MegaMenuItemText';
import { getDragHandleStyles } from './styles';
import { hasChildMatch } from './utils';

interface Props {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClick?: () => void;
  level?: number;
  /** Tighten the icon→label gap (the pinned Starred section uses this to match the breadcrumb rows). */
  tightLabelGap?: boolean;
  /** Drop empty pin/hide control columns instead of reserving them. The pinned box has nothing
   * hideable, so this keeps the unpin flush right, aligned with the breadcrumb rows' unpin. */
  collapseEmptyControls?: boolean;
  onPin: (item: NavModelItem) => void;
  isPinned: (id?: string) => boolean;
  /** Menu is in customise mode: show visibility toggles instead of bookmark pins */
  editMode?: boolean;
  /** Whether an item is allowed to be hidden */
  isHideable?: (item: NavModelItem) => boolean;
  /** Whether an item's own id is in the in-progress hidden set */
  isHidden?: (item: NavModelItem) => boolean;
  onToggleHidden?: (item: NavModelItem, effectivelyHidden: boolean) => void;
  /** Whether an ancestor of this item is hidden (so this item is implicitly hidden too) */
  ancestorHidden?: boolean;
  /** When set (top-level rows in edit mode), makes the row draggable and shows a drag handle */
  draggableProvided?: DraggableProvided;
  /** Prefix for the collapse-state localStorage key, so a section shown both in the pinned box and
   * the nav (e.g. Starred) doesn't share — and fight over — the same expand state. */
  expandKeyPrefix?: string;
  /** Initial collapse state when nothing is stored yet (defaults to "expanded if a child is active"). */
  defaultExpanded?: boolean;
  /** Customisation is enabled — gates the new pin/hide behaviour; off restores the legacy bookmarks UI */
  canCustomise?: boolean;
  /** Section-level only: children are being fetched, show placeholders instead of the empty message */
  loadingChildren?: boolean;
  /** Section-level only: fetching children failed, show an error instead of the empty message */
  childrenLoadError?: boolean;
  /** Disable the pin/hide controls (e.g. while a save is in flight) so edits can't be made and lost. */
  disabled?: boolean;
}

const MAX_DEPTH = 2;

export function MegaMenuItem({
  link,
  activeItem,
  level = 0,
  tightLabelGap,
  collapseEmptyControls,
  onClick,
  onPin,
  isPinned,
  editMode,
  isHideable,
  isHidden,
  onToggleHidden,
  ancestorHidden,
  draggableProvided,
  expandKeyPrefix = '',
  defaultExpanded,
  canCustomise,
  loadingChildren,
  childrenLoadError,
  disabled,
}: Props) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuIsDocked = state.megaMenuDocked;
  // An item is effectively hidden if it's hidden itself or any ancestor is — children of a hidden
  // parent are greyed out and show the eye-slash icon so individual ones can be revealed.
  const effectivelyHidden = Boolean(ancestorHidden) || Boolean(isHidden?.(link));
  const location = useLocation();
  const hasActiveChild = hasChildMatch(link, activeItem);
  const isActive = link === activeItem || (level === MAX_DEPTH && hasActiveChild);
  // Starred leaf rows (id `starred/<uid>`) carry a per-kind icon (folder vs dashboard) that must
  // render alongside the label the same way section-header icons do, so the two kinds are distinguishable.
  const isStarredLeaf = Boolean(link.id?.startsWith(ID_PREFIX));
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(
    `grafana.navigation.expanded[${expandKeyPrefix}${link.text}]`,
    defaultExpanded ?? Boolean(hasActiveChild)
  );
  // Only count children that actually render (create actions are filtered out below), so a section
  // whose visible children are all hidden doesn't keep an expand button that opens to nothing.
  const hasRenderableChildren = (link.children ?? []).some((child) => !child.isCreateAction);
  const showExpandButton =
    level < MAX_DEPTH && Boolean(hasRenderableChildren || link.emptyMessage || loadingChildren || childrenLoadError);
  const childrenVisible = showExpandButton && sectionExpanded;
  const item = useRef<HTMLLIElement | null>(null);

  // Keep the local ref (used for scroll-into-view) while also handing the node to the draggable.
  const setItemRef = (node: HTMLLIElement | null) => {
    item.current = node;
    draggableProvided?.innerRef(node);
  };

  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragHandleStyles);

  // expand parent sections if child is active
  useEffect(() => {
    if (hasActiveChild) {
      setSectionExpanded(true);
    }
  }, [hasActiveChild, location, menuIsDocked, setSectionExpanded]);

  // scroll active element into center if it's offscreen
  useEffect(() => {
    if (isActive && item.current && isElementOffscreen(item.current)) {
      item.current.scrollIntoView({
        block: 'center',
      });
    }
  }, [isActive]);

  if (!link.url) {
    return null;
  }

  // Announce the kind on starred-leaf icons so a same-named dashboard/folder pair doesn't read
  // as two identical links to screen readers. Only the two icons starredNavEntry produces are
  // mapped; anything else stays untitled (and thus aria-hidden), so a future kind never gets a
  // wrong label. Level-0 section icons must stay aria-hidden or they double-announce the label.
  let starredLeafIconTitle: string | undefined;
  if (isStarredLeaf) {
    if (link.icon === 'folder') {
      starredLeafIconTitle = t('navigation.megamenu-item.starred-folder-icon', 'Folder');
    } else if (link.icon === 'apps') {
      starredLeafIconTitle = t('navigation.megamenu-item.starred-dashboard-icon', 'Dashboard');
    }
  }

  let iconElement: React.JSX.Element | null = null;

  if (link.icon) {
    iconElement = (
      <Icon className={styles.icon} name={toIconName(link.icon) ?? 'link'} size="lg" title={starredLeafIconTitle} />
    );
  } else if (link.img) {
    iconElement = (
      <Stack width={3} justifyContent="center">
        <img className={styles.img} src={link.img} alt="" />
      </Stack>
    );
  }

  function getIconName(isExpanded: boolean) {
    return isExpanded ? 'angle-up' : 'angle-down';
  }

  // Whether to render the bookmark/pin control. With customisation off it's the legacy behaviour:
  // every item shows it (gating lives in MegaMenuItemText). With it on, any nav item is pinnable
  // except Home and the dynamic starred sub-items (`starred/<uid>`) — including top-level sections,
  // parents and leaves alike. (Bookmarks is already dropped from the tree when customising.)
  const isPinnableItem = link.id !== 'home' && !link.id?.startsWith(ID_PREFIX);
  const showPin = !canCustomise || isPinnableItem;

  return (
    <li ref={setItemRef} className={styles.listItem} {...draggableProvided?.draggableProps}>
      <div className={styles.menuItem}>
        {/* Reserve the drag column on every row while editing (only top-level rows are draggable) so
            the content columns line up between top-level sections and their children. */}
        {editMode && (
          <div className={dragStyles.column}>
            {draggableProvided && (
              <div
                className={dragStyles.handle}
                {...draggableProvided.dragHandleProps}
                aria-label={t('navigation.megamenu-item.reorder-aria-label', 'Reorder {{itemName}}', {
                  itemName: link.text,
                })}
              >
                <Icon name="draggabledots" size="md" />
              </div>
            )}
          </div>
        )}
        {level !== 0 && <Indent level={level === MAX_DEPTH ? level - 1 : level} spacing={3} />}
        {level === MAX_DEPTH && <div className={styles.itemConnector} />}
        <div className={styles.collapsibleSectionWrapper}>
          <MegaMenuItemText
            isActive={isActive}
            onClick={() => {
              link.onClick?.();
              onClick?.();
            }}
            target={link.target}
            url={link.url}
            onPin={() => onPin(link)}
            isPinned={isPinned(link.url)}
            showPin={showPin}
            itemName={link.text}
            canCustomise={canCustomise}
            editMode={editMode}
            // Hiding works at any depth — offer the eye on every hideable nav row.
            isHideable={isHideable?.(link) ?? false}
            isHidden={effectivelyHidden}
            onToggleHidden={() => onToggleHidden?.(link, effectivelyHidden)}
            collapseEmptyControls={collapseEmptyControls}
            disabled={disabled}
          >
            {/* labelWrapperWithIcon spacing is a top-level alignment concern; starred leaves are a
                uniform indented group that already align among themselves, so they intentionally
                render the icon without it. */}
            <div
              className={cx(styles.labelWrapper, {
                [styles.tightLabelGap]: tightLabelGap,
                [styles.hasActiveChild]: hasActiveChild,
                [styles.labelWrapperWithIcon]: Boolean(level === 0 && iconElement),
              })}
            >
              {(level === 0 || isStarredLeaf) && iconElement}
              <Text truncate element="p">
                {link.text}
              </Text>
              {/* Hide the "New!" badge while customising — it competes with the edit controls. */}
              {link.isNew && !editMode && <FeatureBadge featureState={FeatureState.new} />}
            </div>
          </MegaMenuItemText>
        </div>
        <div className={styles.collapseButtonWrapper}>
          {showExpandButton && (
            <IconButton
              aria-label={
                sectionExpanded
                  ? t('navigation.megamenu-item.collapse-aria-label', 'Collapse section: {{sectionName}}', {
                      sectionName: link.text,
                    })
                  : t('navigation.megamenu-item.expand-aria-label', 'Expand section: {{sectionName}}', {
                      sectionName: link.text,
                    })
              }
              aria-expanded={Boolean(sectionExpanded)}
              className={styles.collapseButton}
              onClick={() => setSectionExpanded(!sectionExpanded)}
              name={getIconName(Boolean(sectionExpanded))}
              size="md"
              variant="secondary"
            />
          )}
        </div>
      </div>
      {childrenVisible && (
        <ul className={styles.children}>
          {linkHasChildren(link) ? (
            link.children
              .filter((childLink) => !childLink.isCreateAction)
              .map((childLink) => (
                <MegaMenuItem
                  key={childLink.id ?? `${link.text}-${childLink.text}`}
                  link={childLink}
                  activeItem={activeItem}
                  onClick={onClick}
                  level={level + 1}
                  onPin={onPin}
                  isPinned={isPinned}
                  editMode={editMode}
                  isHideable={isHideable}
                  isHidden={isHidden}
                  onToggleHidden={onToggleHidden}
                  ancestorHidden={effectivelyHidden}
                  canCustomise={canCustomise}
                  tightLabelGap={tightLabelGap}
                  collapseEmptyControls={collapseEmptyControls}
                  disabled={disabled}
                />
              ))
          ) : loadingChildren ? (
            <Box
              display="flex"
              direction="column"
              gap={0.5}
              padding={1}
              paddingLeft={6}
              aria-live="polite"
              aria-label={t('navigation.megamenu-item.loading-aria-label', 'Loading {{sectionName}}', {
                sectionName: link.text,
              })}
            >
              <Skeleton width={120} />
              <Skeleton width={90} />
            </Box>
          ) : childrenLoadError ? (
            <div className={styles.emptyMessage} aria-live="polite">
              {t('navigation.megamenu-item.children-error', 'Failed to load items')}
            </div>
          ) : (
            <div className={styles.emptyMessage} aria-live="polite">
              {link.emptyMessage}
            </div>
          )}
        </ul>
      )}
      {childrenVisible && link.id === 'dashboards/browse' && config.featureToggles.scopeFilters && (
        <ErrorBoundaryAlert boundaryName="megamenu-scopes-dashboards">
          <ScopesDashboards inline />
        </ErrorBoundaryAlert>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    width: theme.spacing(3),
  }),
  img: css({
    height: theme.spacing(2),
    width: theme.spacing(2),
  }),
  listItem: css({
    flex: 1,
    maxWidth: '100%',
  }),
  menuItem: css({
    display: 'flex',
    alignItems: 'center',
    // Tighter gap so the customise controls sit close to the chevron and the label uses the width.
    gap: theme.spacing(1),
    height: theme.spacing(4),
    position: 'relative',
  }),
  collapseButtonWrapper: css({
    display: 'flex',
    justifyContent: 'center',
    width: theme.spacing(2),
    flexShrink: 0,
  }),
  itemConnector: css({
    position: 'relative',
    height: '100%',
    width: theme.spacing(1.5),
    '&::before': {
      borderLeft: `1px solid ${theme.colors.border.medium}`,
      content: '""',
      height: '100%',
      right: 0,
      position: 'absolute',
      transform: 'translateX(50%)',
    },
  }),
  collapseButton: css({
    margin: 0,
  }),
  collapsibleSectionWrapper: css({
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    height: '100%',
    minWidth: 0,
  }),
  labelWrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    minWidth: 0,
  }),
  // Tighten the icon→label gap so the pinned Starred section's label lines up with the breadcrumb rows.
  tightLabelGap: css({
    gap: theme.spacing(0.5),
  }),
  hasActiveChild: css({
    color: theme.colors.text.primary,
  }),
  labelWrapperWithIcon: css({
    minWidth: theme.spacing(7),
    paddingLeft: theme.spacing(0.5),
  }),
  children: css({
    display: 'flex',
    listStyleType: 'none',
    flexDirection: 'column',
  }),
  emptyMessage: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(1, 1.5, 1, 7),
  }),
});

function linkHasChildren(link: NavModelItem): link is NavModelItem & { children: NavModelItem[] } {
  return Boolean(link.children && link.children.length > 0);
}

function isElementOffscreen(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.bottom < 0 || rect.top >= window.innerHeight;
}
