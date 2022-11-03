import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Button, Icon, useStyles2 } from '@grafana/ui';

import { NavBarItemIcon } from '../NavBar/NavBarItemIcon';
import { NavFeatureHighlight } from '../NavBar/NavFeatureHighlight';
import { getNavTitle } from '../NavBar/navBarItem-translations';
import { hasChildMatch } from '../NavBar/utils';

import { NavBarMenuItem } from './NavBarMenuItem';

export function NavBarMenuSection({
  link,
  activeItem,
  children,
  className,
  onClose,
}: {
  link: NavModelItem;
  activeItem?: NavModelItem;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  const styles = useStyles2(getStyles);
  const FeatureHighlightWrapper = link.highlightText ? NavFeatureHighlight : React.Fragment;
  const isActive = link === activeItem;
  const hasActiveChild = hasChildMatch(link, activeItem);
  const [sectionExpanded, setSectionExpanded] = useState(Boolean(hasActiveChild));

  return (
    <>
      <div className={cx(styles.collapsibleSectionWrapper, className)}>
        <NavBarMenuItem
          isActive={link === activeItem}
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
            <FeatureHighlightWrapper>
              <NavBarItemIcon link={link} />
            </FeatureHighlightWrapper>
            {getNavTitle(link.id) ?? link.text}
          </div>
        </NavBarMenuItem>
        {Boolean(link.children?.length) && (
          <Button
            aria-label={`${sectionExpanded ? 'Collapse' : 'Expand'} section`}
            variant="secondary"
            fill="text"
            className={styles.collapseButton}
            onClick={() => setSectionExpanded(!sectionExpanded)}
          >
            <Icon name={sectionExpanded ? 'angle-up' : 'angle-down'} size="xl" />
          </Button>
        )}
      </div>
      {sectionExpanded && children}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  collapsibleSectionWrapper: css({
    alignItems: 'center',
    display: 'flex',
  }),
  collapseButton: css({
    color: theme.colors.text.disabled,
    padding: theme.spacing(0, 0.5),
    marginRight: theme.spacing(1),
  }),
  collapseWrapperActive: css({
    backgroundColor: theme.colors.action.disabledBackground,
  }),
  collapseContent: css({
    padding: 0,
  }),
  labelWrapper: css({
    display: 'grid',
    fontSize: theme.typography.pxToRem(14),
    gridAutoFlow: 'column',
    gridTemplateColumns: `${theme.spacing(7)} auto`,
    placeItems: 'center',
    fontWeight: theme.typography.fontWeightMedium,
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
      borderRadius: theme.shape.borderRadius(1),
      backgroundImage: theme.colors.gradients.brandVertical,
    },
  }),
  hasActiveChild: css({
    color: theme.colors.text.primary,
  }),
});
