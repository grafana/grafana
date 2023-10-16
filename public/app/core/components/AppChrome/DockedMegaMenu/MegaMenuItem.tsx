import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2, Text, IconButton } from '@grafana/ui';

import { Indent } from '../../Indent/Indent';

import { FeatureHighlight } from './FeatureHighlight';
import { MegaMenuItemIcon } from './MegaMenuItemIcon';
import { MegaMenuItemText } from './MegaMenuItemText';
import { hasChildMatch } from './utils';

interface Props {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClose?: () => void;
  level?: number;
}

export function MegaMenuItem({ link, activeItem, level = 0, onClose }: Props) {
  const FeatureHighlightWrapper = link.highlightText ? FeatureHighlight : React.Fragment;
  const isActive = link === activeItem;
  const hasActiveChild = hasChildMatch(link, activeItem);
  const [sectionExpanded, setSectionExpanded] =
    useLocalStorage(`grafana.navigation.expanded[${link.text}]`, false) ?? Boolean(hasActiveChild);
  const showExpandButton = Boolean(linkHasChildren(link) || link.emptyMessage);

  const styles = useStyles2(getStyles, level, showExpandButton);

  return (
    <li>
      <div className={styles.menuItem}>
        <Indent level={level} spacing={2} />
        <div className={styles.collapseButtonWrapper}>
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
              onClose?.();
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
              {/* This div is needed in order to ensure the text is placed in grid column 2
              TODO: Can we do this any better? */}
              {/*<div className={styles.iconWrapper}>*/}
              <FeatureHighlightWrapper>
                <>{level === 0 && <MegaMenuItemIcon link={link} />}</>
              </FeatureHighlightWrapper>
              {/*</div>*/}
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
                  onClose={onClose}
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

const getStyles = (theme: GrafanaTheme2, level: Props['level'], showExpandButton: boolean) => ({
  menuItem: css([
    {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
    },
  ]),
  collapseButtonWrapper: css({
    display: 'flex',
    alignItems: 'center',
    width: theme.spacing(3),
  }),
  collapseButton: css([
    {
      color: theme.colors.text.disabled,
    },
  ]),
  collapsibleSectionWrapper: css([
    {
      alignItems: 'center',
      display: 'flex',
    },
    // level === 2 && {
    //   marginLeft: theme.spacing(8.5),
    //
    //   '&::before': {
    //     content: '""',
    //     height: theme.spacing(4.75),
    //     position: 'absolute',
    //     width: 1,
    //     left: 61,
    //     borderLeft: `1px solid ${theme.colors.text.secondary}`,
    //   },
    // },
  ]),
  labelWrapper: css([
    {
      display: 'flex',
      fontSize: theme.typography.pxToRem(14),
      alignItems: 'center',
      gap: theme.spacing(2),
      fontWeight: theme.typography.fontWeightMedium,
      paddingLeft: theme.spacing(1),
    },
  ]),
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
