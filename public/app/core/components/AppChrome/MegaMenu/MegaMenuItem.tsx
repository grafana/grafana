import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';
import { useEffect, useRef } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';
import { useLocation } from 'react-router-dom-v5-compat';
import { useLocalStorage } from 'react-use';

import { FeatureState, type GrafanaTheme2, type NavModelItem, toIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, Text, IconButton, Icon, Stack, FeatureBadge, Box } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';

import { Indent } from '../../Indent/Indent';

import { MegaMenuItemText } from './MegaMenuItemText';
import { hasChildMatch } from './utils';

interface Props {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClick?: () => void;
  level?: number;
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
  /** This item is a pinned row rendered at the top of the menu */
  pinned?: boolean;
  /** When set (top-level pinned rows in edit mode), makes the row draggable and shows a drag handle */
  draggableProvided?: DraggableProvided;
  /** Customisation is enabled — gates the new pin/hide behaviour; off restores the legacy bookmarks UI */
  canCustomise?: boolean;
  /** Section-level only: children are being fetched, show placeholders instead of the empty message */
  loadingChildren?: boolean;
  /** Section-level only: fetching children failed, show an error instead of the empty message */
  childrenLoadError?: boolean;
}

const MAX_DEPTH = 2;

export function MegaMenuItem({
  link,
  activeItem,
  level = 0,
  onClick,
  onPin,
  isPinned,
  editMode,
  isHideable,
  isHidden,
  onToggleHidden,
  ancestorHidden,
  pinned,
  draggableProvided,
  canCustomise,
  loadingChildren,
  childrenLoadError,
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
  // Pinned sections use a separate expand-state key (and default to expanded) so a section shown
  // both pinned and in the normal nav doesn't share — and fight over — the same collapse state.
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(
    `grafana.navigation.expanded[${pinned ? 'pinned/' : ''}${link.text}]`,
    pinned ? true : Boolean(hasActiveChild)
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

  let iconElement: React.JSX.Element | null = null;

  if (link.icon) {
    iconElement = <Icon className={styles.icon} name={toIconName(link.icon) ?? 'link'} size="lg" />;
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
  // every item shows it (the signed-in / non-bookmarks gating lives in MegaMenuItemText). With it
  // on, Home and individual starred dashboards (the `starred/` prefix) are never pinnable; every
  // other row is actionable, including intermediate subsections in the pinned area (so a child
  // section of a whole-pinned section — e.g. Administration → General — can be unpinned).
  const isPinnableItem = link.id !== 'home' && !link.id?.startsWith(ID_PREFIX);
  const showPin = !canCustomise || isPinnableItem;

  return (
    <li ref={setItemRef} className={styles.listItem} {...draggableProvided?.draggableProps}>
      <div className={styles.menuItem}>
        {draggableProvided && (
          <div
            className={styles.dragHandle}
            {...draggableProvided.dragHandleProps}
            aria-label={t('navigation.megamenu-item.reorder-aria-label', 'Reorder {{itemName}}', {
              itemName: link.text,
            })}
          >
            <Icon name="draggabledots" size="lg" />
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
            // Pinned rows offer unpin (the pin control), never the hide/eye control.
            isHideable={pinned ? false : isHideable?.(link)}
            isHidden={effectivelyHidden}
            onToggleHidden={() => onToggleHidden?.(link, effectivelyHidden)}
          >
            <div
              className={cx(styles.labelWrapper, {
                [styles.hasActiveChild]: hasActiveChild,
                [styles.labelWrapperWithIcon]: Boolean(level === 0 && iconElement),
              })}
            >
              {level === 0 && iconElement}
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
                  key={`${link.text}-${childLink.text}`}
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
                  pinned={pinned}
                  canCustomise={canCustomise}
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
  dragHandle: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    cursor: 'grab',
    display: 'flex',
    '&:hover': {
      color: theme.colors.text.primary,
    },
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
