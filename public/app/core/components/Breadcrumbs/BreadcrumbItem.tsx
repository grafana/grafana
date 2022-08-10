import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, LinkButton, useStyles2 } from '@grafana/ui';

import { Breadcrumb } from './types';

type Props = Breadcrumb & {
  isCurrent: boolean;
};

export function BreadcrumbItem(props: Props) {
  const styles = useStyles2(getStyles);
  return (
    <li className={styles.breadcrumbWrapper}>
      {props.isCurrent ? (
        <span className={styles.breadcrumb} aria-current="page">
          {props.text}
        </span>
      ) : (
        <>
          {'icon' in props ? (
            <LinkButton
              size="md"
              variant="secondary"
              fill="text"
              icon={props.icon}
              href={props.href}
              aria-label={props.text}
            />
          ) : (
            <a className={cx(styles.breadcrumb, styles.breadcrumbLink)} href={props.href}>
              {props.text}
            </a>
          )}
          <div className={styles.separator} aria-hidden={true}>
            <Icon name="angle-right" />
          </div>
        </>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    breadcrumb: css({
      alignItems: 'center',
      display: 'flex',
      padding: theme.spacing(0, 0.5),
      whiteSpace: 'nowrap',
    }),
    breadcrumbLink: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    breadcrumbWrapper: css({
      alignItems: 'center',
      color: theme.colors.text.primary,
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    separator: css({
      color: theme.colors.text.secondary,
    }),
  };
};
