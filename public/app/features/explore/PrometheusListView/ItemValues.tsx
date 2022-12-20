import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data/src';
import { useStyles } from '@grafana/ui/src';

import { rawListItemColumnWidth, rawListpaddingToHoldSpaceForCopyIcon, RawListValue } from './RawListItem';

const getStyles = (theme: GrafanaTheme, totalNumberOfValues: number) => ({
  rowValue: css`
    min-width: ${rawListItemColumnWidth};
  `,
  rowValuesWrap: css`
    padding-left: ${rawListpaddingToHoldSpaceForCopyIcon};
    width: calc(${totalNumberOfValues} * ${rawListItemColumnWidth});
    display: flex;
  `,
});

export const ItemValues = ({
  totalNumberOfValues,
  values,
  hideFieldsWithoutValues,
}: {
  totalNumberOfValues: number;
  values: RawListValue[];
  hideFieldsWithoutValues: boolean;
}) => {
  const styles = useStyles((theme) => getStyles(theme, totalNumberOfValues));
  return (
    <div className={styles.rowValuesWrap}>
      {values?.map((value) => {
        if (hideFieldsWithoutValues) {
          if (value.value !== undefined && value.value !== ' ') {
            return (
              <span key={value.key} className={styles.rowValue}>
                {value.value}
              </span>
            );
          } else {
            return null;
          }
        } else {
          return (
            <span key={value.key} className={styles.rowValue}>
              {value.value}
            </span>
          );
        }
      })}
    </div>
  );
};
