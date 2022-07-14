import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2, Icon, IconName } from '@grafana/ui';

export interface Props {
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
}

export interface Breadcrumb {
  text?: string;
  icon?: IconName;
  href?: string;
}

export function Breadcrumbs({ sectionNav, pageNav }: Props) {
  const styles = useStyles2(getStyles);
  const crumbs: Breadcrumb[] = [{ icon: 'home-alt', href: '/' }];

  function addCrumbs(node: NavModelItem) {
    if (node.parentItem) {
      addCrumbs(node.parentItem);
    }

    crumbs.push({ text: node.text, href: node.url });
  }

  addCrumbs(sectionNav);

  if (pageNav) {
    addCrumbs(pageNav);
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
      flexWrap: 'nowrap',
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
      whiteSpace: 'nowrap',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
