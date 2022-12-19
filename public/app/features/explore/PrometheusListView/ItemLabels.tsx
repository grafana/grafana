import React from 'react';

import { Field } from '@grafana/data/src';

import { getRawListContainerStyles } from './RawListContainer';

export const ItemLabels = ({ valueLabels }: { valueLabels: Field[] }) => {
  const styles = getRawListContainerStyles();
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
