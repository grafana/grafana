import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2, Icon, IconName } from '@grafana/ui';

import { TopNavProps } from './TopNavUpdate';

export interface Props extends TopNavProps {
  sectionNav: NavModelItem;
  subNav?: NavModelItem;
}

export interface Breadcrumb {
  text?: string;
  icon?: IconName;
  href?: string;
}

export function Breadcrumbs({ sectionNav, subNav }: Props) {
  const styles = useStyles2(getStyles);
  const crumbs: Breadcrumb[] = [{ icon: 'home', href: '/' }];

  function addCrumbs(node: NavModelItem) {
    if (node.parentItem) {
      addCrumbs(node.parentItem);
    }

    crumbs.push({ text: node.text, href: node.url });
  }

  addCrumbs(sectionNav);

  if (subNav) {
    addCrumbs(subNav);
  }

  return (
    <ul className={styles.breadcrumbs}>
      {crumbs.map((breadcrumb, index) => (
        <li className={styles.breadcrumb} key={index}>
          {breadcrumb.href && (
            <a className={styles.breadcrumbLink} href={breadcrumb.href}>
              {breadcrumb.text}
              {breadcrumb.icon && <Icon name={breadcrumb.icon} />}
            </a>
          )}
          {!breadcrumb.href && <span className={styles.breadcrumbLink}>{breadcrumb.text}</span>}
          {index + 1 < crumbs.length && (
            <div className={styles.separator}>
              <Icon name="angle-right" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    breadcrumbs: css({
      display: 'flex',
      alignItems: 'center',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    breadcrumb: css({
      display: 'flex',
      alignItems: 'center',
    }),
    separator: css({
      color: theme.colors.text.secondary,
      padding: theme.spacing(0, 0.5),
    }),
    breadcrumbLink: css({
      color: theme.colors.text.primary,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
