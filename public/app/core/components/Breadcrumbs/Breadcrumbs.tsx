import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Breadcrumb } from './Breadcrumb';
import { Breadcrumb as BreadcrumbType } from './types';

export interface Props {
  breadcrumbs: BreadcrumbType[];
}

export function Breadcrumbs({ breadcrumbs }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <nav aria-label="Breadcrumbs">
      <ol className={styles.breadcrumbs}>
        {breadcrumbs.map((breadcrumb, index) => (
          <Breadcrumb {...breadcrumb} isCurrent={index === breadcrumbs.length - 1} key={index} />
        ))}
      </ol>
    </nav>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    breadcrumbs: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'nowrap',
    }),
  };
};
