import { css } from '@emotion/css';
import React from 'react';

import { Field } from '@grafana/data/src';
import { stylesFactory } from '@grafana/ui/src';

import { rawListItemColumnWidth } from './RawListItem';

const getItemLabelsStyles = stylesFactory(() => {
  return {
    valueNavigation: css`
      width: ${rawListItemColumnWidth};
    `,
    valueNavigationWrapper: css`
      display: flex;
      justify-content: flex-end;
    `,
  };
});

export const ItemLabels = ({ valueLabels }: { valueLabels: Field[] }) => {
  const styles = getItemLabelsStyles();
  return (
    <div>
      <div className={styles.valueNavigationWrapper}>
        {valueLabels.map((value, index) => {
          return (
            <span className={styles.valueNavigation} key={index}>
              {value.name}
            </span>
          );
        })}
      </div>
    </div>
  );
};
