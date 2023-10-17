import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, NavModelItem, toIconName } from '@grafana/data';
import { useStyles2, Text, IconButton, Icon } from '@grafana/ui';

import { Indent } from '../../Indent/Indent';

import { FeatureHighlight } from './FeatureHighlight';
import { MegaMenuItemText } from './MegaMenuItemText';
import { hasChildMatch } from './utils';

interface Props {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClick?: () => void;
  level?: number;
}

const MAX_DEPTH = 2;

export function MegaMenuItem({ link, activeItem, level = 0, onClick }: Props) {
  const FeatureHighlightWrapper = link.highlightText ? FeatureHighlight : React.Fragment;
  const isActive = link === activeItem;
  const hasActiveChild = hasChildMatch(link, activeItem);
  const [sectionExpanded, setSectionExpanded] =
    useLocalStorage(`grafana.navigation.expanded[${link.text}]`, false) ?? Boolean(hasActiveChild);
  const showExpandButton = level < MAX_DEPTH && Boolean(linkHasChildren(link) || link.emptyMessage);

  const styles = useStyles2(getStyles);

  return (
    <li className={styles.listItem}>
      <div className={styles.menuItem}>
        {level !== 0 && <Indent level={level === 1 ? 1.2 : 1.7} spacing={3} />}
        <div
          className={cx(styles.collapseButtonWrapper, {
            [styles.itemConnector]: level >= 2,
          })}
        >
          {showExpandButton && (
            <IconButton
              aria-label={`${sectionExpanded ? 'Collapse' : 'Expand'} section ${link.text}`}
              className={styles.collapseButton}
              onClick={() => setSectionExpanded(!sectionExpanded)}
              name={sectionExpanded ? 'angle-up' : 'angle-down'}
              size="xl"
            />
          )}
        </div>
        <div className={styles.collapsibleSectionWrapper}>
          <MegaMenuItemText
            isActive={isActive}
            onClick={() => {
              link.onClick?.();
              onClick?.();
            }}
            target={link.target}
            url={link.url}
          >
            <div
              className={cx(styles.labelWrapper, {
                [styles.isActive]: isActive,
                [styles.hasActiveChild]: hasActiveChild,
              })}
            >
              <FeatureHighlightWrapper>
                <>{level === 0 && link.icon && <Icon name={toIconName(link.icon) ?? 'link'} size="lg" />}</>
              </FeatureHighlightWrapper>
              <Text truncate>{link.text}</Text>
            </div>
          </MegaMenuItemText>
        </div>
      </div>
      {showExpandButton && sectionExpanded && (
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
                />
              ))
          ) : (
            <div className={styles.emptyMessage}>{link.emptyMessage}</div>
          )}
        </ul>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    flex: 1,
    maxWidth: '100%',
  }),
  menuItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    position: 'relative',
  }),
  collapseButtonWrapper: css({
    display: 'flex',
    alignItems: 'center',
    width: theme.spacing(3),
    flexShrink: 0,
  }),
  itemConnector: css({
    '&::before': {
      content: '""',
      height: '100%',
      position: 'absolute',
      borderLeft: `1px solid ${theme.colors.border.medium}`,
    },
  }),
  collapseButton: css({
    color: theme.colors.text.disabled,
  }),
  collapsibleSectionWrapper: css({
    alignItems: 'center',
    display: 'flex',
    minWidth: 0,
  }),
  labelWrapper: css({
    display: 'flex',
    fontSize: theme.typography.pxToRem(14),
    alignItems: 'center',
    gap: theme.spacing(2),
    fontWeight: theme.typography.fontWeightMedium,
    paddingLeft: theme.spacing(1),
    minWidth: 0,
  }),
  isActive: css({
    color: theme.colors.text.primary,
  }),
  iconWrapper: css({
    width: theme.spacing(5),
  }),
  hasActiveChild: css({
    color: theme.colors.text.primary,
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
