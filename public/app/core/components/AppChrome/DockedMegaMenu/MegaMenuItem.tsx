import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Button, Icon, useStyles2, Text } from '@grafana/ui';

import { Indent } from '../../Indent/Indent';

import { FeatureHighlight } from './FeatureHighlight';
import { MegaMenuItemIcon } from './MegaMenuItemIcon';
import { MegaMenuItemText } from './MegaMenuItemText';
import { hasChildMatch } from './utils';

interface Props {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClick?: () => void;
  level?: number;
}

// max level depth to render
const MAX_DEPTH = 2;

export function MegaMenuItem({ link, activeItem, level = 0, onClick }: Props) {
  const styles = useStyles2(getStyles);
  const FeatureHighlightWrapper = link.highlightText ? FeatureHighlight : React.Fragment;
  const isActive = link === activeItem;
  const hasActiveChild = hasChildMatch(link, activeItem);
  const [sectionExpanded, setSectionExpanded] =
    useLocalStorage(`grafana.navigation.expanded[${link.text}]`, false) ?? Boolean(hasActiveChild);
  const showExpandButton = level < MAX_DEPTH && (linkHasChildren(link) || link.emptyMessage);

  return (
    <li className={styles.listItem}>
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
              <div className={styles.iconWrapper}>{level === 0 && <MegaMenuItemIcon link={link} />}</div>
            </FeatureHighlightWrapper>
            <Indent level={Math.max(0, level - 1)} spacing={2} />
            <Text truncate>{link.text}</Text>
          </div>
        </MegaMenuItemText>
        {showExpandButton && (
          <Button
            aria-label={`${sectionExpanded ? 'Collapse' : 'Expand'} section ${link.text}`}
            variant="secondary"
            fill="text"
            className={styles.collapseButton}
            onClick={() => setSectionExpanded(!sectionExpanded)}
          >
            <Icon name={sectionExpanded ? 'angle-up' : 'angle-down'} size="xl" />
          </Button>
        )}
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
  children: css({
    display: 'flex',
    listStyleType: 'none',
    flexDirection: 'column',
  }),
  collapsibleSectionWrapper: css({
    alignItems: 'center',
    display: 'flex',
  }),
  collapseButton: css({
    color: theme.colors.text.disabled,
    padding: theme.spacing(0, 0.5),
    marginRight: theme.spacing(1),
  }),
  emptyMessage: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    padding: theme.spacing(1, 1.5, 1, 7),
  }),
  iconWrapper: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  labelWrapper: css({
    display: 'grid',
    fontSize: theme.typography.pxToRem(14),
    gridAutoFlow: 'column',
    gridTemplateColumns: `${theme.spacing(7)} auto`,
    alignItems: 'center',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  listItem: css({
    flex: 1,
  }),
  isActive: css({
    color: theme.colors.text.primary,

    '&::before': {
      display: 'block',
      content: '" "',
      height: theme.spacing(3),
      position: 'absolute',
      left: theme.spacing(1),
      top: '50%',
      transform: 'translateY(-50%)',
      width: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      backgroundImage: theme.colors.gradients.brandVertical,
    },
  }),
  hasActiveChild: css({
    color: theme.colors.text.primary,
  }),
});

function linkHasChildren(link: NavModelItem): link is NavModelItem & { children: NavModelItem[] } {
  return Boolean(link.children && link.children.length > 0);
}
