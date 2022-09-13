import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2, Icon } from '@grafana/ui';

export interface Props {
  item: NavModelItem;
}

export function SectionNavItem({ item }: Props) {
  const styles = useStyles2(getStyles);

  const children = item.children?.filter((x) => !x.hideFromTabs);
  const isRoot = item.parentItem == null;
  const hasActiveChild = Boolean(children?.length && children.find((x) => x.active));

  // If first root child is a section skip the bottom margin (as sections have top margin already)
  const noRootMargin = isRoot && Boolean(item.children![0].children?.length);

  const linkClass = cx({
    [styles.link]: true,
    [styles.activeStyle]: item.active,
    [styles.isSection]: Boolean(children?.length),
    [styles.hasActiveChild]: hasActiveChild,
    [styles.isRoot]: isRoot,
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
        {isRoot && item.icon && <Icon name={item.icon} />}
        {isRoot && item.img && <img className={styles.sectionImg} src={item.img} alt={`logo of ${item.text}`} />}
        {item.text}
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
      gap: ${theme.spacing(1)};
      height: 100%;
      position: relative;
      color: ${theme.colors.text.secondary};

      &:hover,
      &:focus {
        text-decoration: underline;
      }
    `,
    activeStyle: css`
      label: activeTabStyle;
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.action.disabledBackground};
      border-radius: ${theme.shape.borderRadius(2)};
      fontweight: theme.typography.fontWeightMedium;

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
    isRoot: css({
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
