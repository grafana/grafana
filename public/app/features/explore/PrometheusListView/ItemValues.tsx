import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { rawListItemColumnWidth, rawListPaddingToHoldSpaceForCopyIcon, RawListValue } from './RawListItem';
import { RawPrometheusListItemEmptyValue } from './utils/getRawPrometheusListItemsFromDataFrame';

const getStyles = (theme: GrafanaTheme2, totalNumberOfValues: number) => ({
  rowWrapper: css({
    position: 'relative',
    minWidth: rawListItemColumnWidth,
    paddingRight: '5px',
  }),
  rowValue: css({
    whiteSpace: 'nowrap',
    overflowX: 'auto',
    MsOverflowStyle: 'none' /* IE and Edge */,
    scrollbarWidth: 'none' /* Firefox */,
    display: 'block',
    paddingRight: '10px',

    '&::-webkit-scrollbar': {
      display: 'none' /* Chrome, Safari and Opera */,
    },

    '&:before': {
      pointerEvents: 'none',
      content: "''",
      width: '100%',
      height: '100%',
      position: 'absolute',
      left: 0,
      top: 0,
      background: `linear-gradient(to right, transparent calc(100% - 25px), ${theme.colors.background.primary})`,
    },
  }),
  rowValuesWrap: css({
    paddingLeft: rawListPaddingToHoldSpaceForCopyIcon,
    width: `calc(${totalNumberOfValues} * ${rawListItemColumnWidth})`,
    display: 'flex',
  }),
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
  const styles = useStyles2(getStyles, totalNumberOfValues);
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
