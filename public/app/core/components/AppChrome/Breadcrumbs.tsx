import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2, Icon, IconName, LinkButton } from '@grafana/ui';

export interface Props {
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  text?: string;
  icon?: IconName;
  href?: string;
}

export function Breadcrumbs({ breadcrumbs }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.breadcrumbs}>
      {breadcrumbs.map((breadcrumb, index) => (
        <li className={styles.breadcrumb} key={index}>
          {breadcrumb.href && breadcrumb.text && (
            <a className={styles.breadcrumbLink} href={breadcrumb.href}>
              {breadcrumb.text}
            </a>
          )}
          {breadcrumb.href && breadcrumb.icon && (
            <LinkButton size="md" variant="secondary" fill="text" icon={breadcrumb.icon} href={breadcrumb.href} />
          )}
          {!breadcrumb.href && <span className={styles.breadcrumbLink}>{breadcrumb.text}</span>}
          {index + 1 < breadcrumbs.length && (
            <div className={styles.separator}>
              <Icon name="angle-right" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function buildBreadcrumbs(sectionNav: NavModelItem, pageNav?: NavModelItem) {
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

  return crumbs;
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
    }),
    breadcrumbLink: css({
      alignItems: 'center',
      color: theme.colors.text.primary,
      display: 'flex',
      padding: theme.spacing(0, 0.5),
      whiteSpace: 'nowrap',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
