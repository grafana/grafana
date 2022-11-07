import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2, Icon } from '@grafana/ui';

import { getNavTitle } from '../NavBar/navBarItem-translations';

export interface Props {
  item: NavModelItem;
  isSectionRoot?: boolean;
}

export function SectionNavItem({ item, isSectionRoot = false }: Props) {
  const styles = useStyles2(getStyles);

  const children = item.children?.filter((x) => !x.hideFromTabs);
  const hasActiveChild = Boolean(children?.length && children.find((x) => x.active));

  // If first root child is a section skip the bottom margin (as sections have top margin already)
  const noRootMargin = isSectionRoot && Boolean(item.children![0].children?.length);

  const linkClass = cx({
    [styles.link]: true,
    [styles.activeStyle]: item.active,
    [styles.isSection]: Boolean(children?.length) || item.isSection,
    [styles.hasActiveChild]: hasActiveChild,
    [styles.isSectionRoot]: isSectionRoot,
    [styles.noRootMargin]: noRootMargin,
  });

  return (
    <>
      <a
        href={item.url}
        className={linkClass}
        aria-label={selectors.components.Tab.title(item.text)}
        role="tab"
        aria-selected={item.active}
      >
        {isSectionRoot && item.icon && <Icon name={item.icon} />}
        {isSectionRoot && item.img && <img className={styles.sectionImg} src={item.img} alt={`logo of ${item.text}`} />}
        {getNavTitle(item.id) ?? item.text}
        {item.tabSuffix && <item.tabSuffix className={styles.suffix} />}
      </a>
      {children?.map((child, index) => (
        <SectionNavItem item={child} key={index} />
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    link: css`
      padding: ${theme.spacing(1, 0, 1, 1.5)};
      display: flex;
      align-items: center;
      border-radius: ${theme.shape.borderRadius(2)};
      gap: ${theme.spacing(1)};
      height: 100%;
      position: relative;
      color: ${theme.colors.text.secondary};

      &:hover,
      &:focus {
        text-decoration: underline;
        z-index: 1;
      }
    `,
    activeStyle: css`
      label: activeTabStyle;
      color: ${theme.colors.text.primary};
      background: ${theme.colors.emphasize(theme.colors.background.canvas, 0.03)};
      font-weight: ${theme.typography.fontWeightMedium};

      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: 0;
        width: 4px;
        bottom: 2px;
        top: 2px;
        border-radius: 2px;
        background-image: ${theme.colors.gradients.brandVertical};
      }
    `,
    suffix: css`
      margin-left: ${theme.spacing(1)};
    `,
    sectionImg: css({
      height: 18,
    }),
    isSectionRoot: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.h4.fontSize,
      marginTop: 0,
      marginBottom: theme.spacing(2),
      fontWeight: theme.typography.fontWeightMedium,
    }),
    isSection: css({
      fontSize: theme.typography.h5.fontSize,
      marginTop: theme.spacing(2),
      fontWeight: theme.typography.fontWeightMedium,
    }),
    noRootMargin: css({
      marginBottom: 0,
    }),
    hasActiveChild: css({
      color: theme.colors.text.primary,
    }),
  };
};
