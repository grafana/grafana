import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data/src';
import { useStyles } from '@grafana/ui/src';

import { RawPrometheusListItemEmptyValue } from '../utils/getRawPrometheusListItemsFromDataFrame';

import { rawListItemColumnWidth, rawListpaddingToHoldSpaceForCopyIcon, RawListValue } from './RawListItem';

const getStyles = (theme: GrafanaTheme, totalNumberOfValues: number) => ({
  rowWrapper: css`
    position: relative;
    min-width: ${rawListItemColumnWidth};
    padding-right: 5px;
  `,
  rowValue: css`
    white-space: nowrap;
    overflow-x: auto;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    display: block;
    padding-right: 10px;

    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }

    &:before {
      pointer-events: none;
      content: '';
      width: 100%;
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      background: linear-gradient(to right, transparent calc(100% - 25px), ${theme.colors.bg1});
    }
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
          if (value.value !== undefined && value.value !== RawPrometheusListItemEmptyValue) {
            return (
              <span key={value.key} className={styles.rowWrapper}>
                <span className={styles.rowValue}>{value.value}</span>
              </span>
            );
          } else {
            return null;
          }
        } else {
          return (
            <span key={value.key} className={styles.rowWrapper}>
              <span className={styles.rowValue}>{value.value}</span>
            </span>
          );
        }
      })}
    </div>
  );
};
