import { css } from '@emotion/css';
import React from 'react';

import { Field, GrafanaTheme2 } from '@grafana/data/';
import { useStyles2 } from '@grafana/ui/';

import { InstantQueryRefIdIndex } from '../../../plugins/datasource/prometheus/datasource';

import { rawListItemColumnWidth } from './RawListItem';

const getItemLabelsStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  return {
    valueNavigation: css`
      width: ${rawListItemColumnWidth};
      font-weight: bold;
    `,
    valueNavigationWrapper: css`
      display: flex;
      justify-content: flex-end;
    `,
    itemLabelsWrap: css`
      ${!expanded ? `border-bottom: 1px solid ${theme.colors.border.medium}` : ''};
    `,
  };
};

const formatValueName = (name: string): string => {
  if (name.includes(InstantQueryRefIdIndex)) {
    return name.replace(InstantQueryRefIdIndex, '');
  }
  return name;
};

export const ItemLabels = ({ valueLabels, expanded }: { valueLabels: Field[]; expanded: boolean }) => {
  const styles = useStyles2((theme) => getItemLabelsStyles(theme, expanded));

  return (
    <div className={styles.itemLabelsWrap}>
      <div className={styles.valueNavigationWrapper}>
        {valueLabels.map((value, index) => (
          <span className={styles.valueNavigation} key={value.name}>
            {formatValueName(value.name)}
          </span>
        ))}
      </div>
    </div>
  );
};
