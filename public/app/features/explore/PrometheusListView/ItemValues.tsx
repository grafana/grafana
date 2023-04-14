import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { useStyles2 } from '@grafana/ui/';

import { RawPrometheusListItemEmptyValue } from '../utils/getRawPrometheusListItemsFromDataFrame';

import { rawListItemColumnWidth, rawListPaddingToHoldSpaceForCopyIcon, RawListValue } from './RawListItem';

const getStyles = (theme: GrafanaTheme2, totalNumberOfValues: number) => ({
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
      background: linear-gradient(to right, transparent calc(100% - 25px), ${theme.colors.background.primary});
    }
  `,
  rowValuesWrap: css`
    padding-left: ${rawListPaddingToHoldSpaceForCopyIcon};
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
  const styles = useStyles2((theme) => getStyles(theme, totalNumberOfValues));
  return (
    <div role={'cell'} className={styles.rowValuesWrap}>
      {values?.map((value) => {
        if (hideFieldsWithoutValues && (value.value === undefined || value.value === RawPrometheusListItemEmptyValue)) {
          return null;
        }

        return (
          <span key={value.key} className={styles.rowWrapper}>
            <span className={styles.rowValue}>{value.value}</span>
          </span>
        );
      })}
    </div>
  );
};
