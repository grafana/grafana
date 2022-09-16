import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CollapsableSection, useStyles2 } from '@grafana/ui';

import { NavBarItemIcon } from '../NavBar/NavBarItemIcon';
import { NavFeatureHighlight } from '../NavBar/NavFeatureHighlight';

export function NavBarMenuSection({
  link,
  isActive,
  children,
  className,
}: {
  link: NavModelItem;
  isActive?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = useStyles2(getStyles);
  const FeatureHighlightWrapper = link.highlightText ? NavFeatureHighlight : React.Fragment;
  const [sectionExpanded, setSectionExpanded] = useState(Boolean(isActive));

  return (
    <li className={cx(styles.collapsibleSectionWrapper, className)}>
      <CollapsableSection
        isOpen={Boolean(sectionExpanded)}
        onToggle={(isOpen) => setSectionExpanded(isOpen)}
        className={styles.collapseWrapper}
        contentClassName={styles.collapseContent}
        label={
          <div className={cx(styles.labelWrapper, { [styles.isActive]: isActive })}>
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
  }),
});
