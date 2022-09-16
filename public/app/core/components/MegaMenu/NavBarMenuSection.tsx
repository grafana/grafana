import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CollapsableSection, useStyles2 } from '@grafana/ui';

import { NavBarItemIcon } from '../NavBar/NavBarItemIcon';
import { NavFeatureHighlight } from '../NavBar/NavFeatureHighlight';
import { hasChildMatch } from '../NavBar/utils';

export function NavBarMenuSection({
  link,
  activeItem,
  children,
  className,
}: {
  link: NavModelItem;
  activeItem?: NavModelItem;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = useStyles2(getStyles);
  const FeatureHighlightWrapper = link.highlightText ? NavFeatureHighlight : React.Fragment;
  const isActive = link === activeItem;
  const hasActiveChild = hasChildMatch(link, activeItem);
  const [sectionExpanded, setSectionExpanded] = useState(Boolean(hasActiveChild));

  return (
    <li className={cx(styles.collapsibleSectionWrapper, className)}>
      <CollapsableSection
        isOpen={Boolean(sectionExpanded)}
        onToggle={(isOpen) => setSectionExpanded(isOpen)}
        className={cx(styles.collapseWrapper, { [styles.collapseWrapperActive]: isActive })}
        contentClassName={styles.collapseContent}
        label={
          <div
            className={cx(styles.labelWrapper, {
              [styles.isActive]: isActive,
              [styles.hasActiveChild]: hasActiveChild,
            })}
          >
            <FeatureHighlightWrapper>
              <NavBarItemIcon link={link} />
            </FeatureHighlightWrapper>
            {link.text}
          </div>
        }
      >
        {children}
      </CollapsableSection>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  collapsibleSectionWrapper: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  }),
  collapseWrapper: css({
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(4.25),
    minHeight: theme.spacing(6),
    overflowWrap: 'anywhere',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    '&:hover, &:focus-within': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-within': {
      boxShadow: 'none',
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
      transition: 'none',
    },
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
