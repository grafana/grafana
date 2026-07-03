import { css, cx } from '@emotion/css';
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
  /** This item is a pinned row rendered at the top of the menu */
  pinned?: boolean;
  /** Customisation is enabled — gates the new pin behaviour; off restores the legacy bookmarks UI */
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
  pinned,
  canCustomise,
  loadingChildren,
  childrenLoadError,
}: Props) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuIsDocked = state.megaMenuDocked;
  const location = useLocation();
  const hasActiveChild = hasChildMatch(link, activeItem);
  const isActive = link === activeItem || (level === MAX_DEPTH && hasActiveChild);
  // Starred leaf rows (id `starred/<uid>`) carry a per-kind icon (folder vs dashboard) that must
  // render alongside the label the same way section-header icons do, so the two kinds are distinguishable.
  const isStarredLeaf = Boolean(link.id?.startsWith(ID_PREFIX));
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
  const item = useRef<HTMLLIElement>(null);

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
  // every item shows it (the signed-in / non-bookmarks gating lives in MegaMenuItemText). With it
  // on: Home and individual starred dashboards (the `starred/` prefix) are never pinnable, and in
  // the pinned area only the section row (level 0) and leaf rows are actionable — not the
  // intermediate structural rows.
  const isPinnableItem = link.id !== 'home' && !link.id?.startsWith(ID_PREFIX);
  const isPinnableRow = pinned ? level === 0 || !linkHasChildren(link) : true;
  const showPin = !canCustomise || (isPinnableItem && isPinnableRow);

  return (
    <li ref={item} className={styles.listItem}>
      <div className={styles.menuItem}>
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
          >
            {/* labelWrapperWithIcon spacing is a top-level alignment concern; starred leaves are a
                uniform indented group that already align among themselves, so they intentionally
                render the icon without it. */}
            <div
              className={cx(styles.labelWrapper, {
                [styles.hasActiveChild]: hasActiveChild,
                [styles.labelWrapperWithIcon]: Boolean(level === 0 && iconElement),
              })}
            >
              {(level === 0 || isStarredLeaf) && iconElement}
              <Text truncate element="p">
                {link.text}
              </Text>
              {link.isNew && <FeatureBadge featureState={FeatureState.new} />}
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
  menuItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    height: theme.spacing(4),
    position: 'relative',
  }),
  collapseButtonWrapper: css({
    display: 'flex',
    justifyContent: 'center',
    width: theme.spacing(3),
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
