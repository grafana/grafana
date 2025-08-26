import { css } from '@emotion/css';
import { useCopyToClipboard } from 'react-use';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isValidLegacyName, utf8Support } from '@grafana/prometheus/src/utf8_support';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';

import { ItemLabels } from './ItemLabels';
import { ItemValues } from './ItemValues';
import { instantQueryRawVirtualizedListData } from './RawListContainer';
import RawListItemAttributes from './RawListItemAttributes';

export interface RawListProps {
  listItemData: instantQueryRawVirtualizedListData;
  listKey: string;
  totalNumberOfValues: number;
  valueLabels?: Field[];
  isExpandedView: boolean;
}

export type RawListValue = { key: string; value: string };
export const rawListExtraSpaceAtEndOfLine = '20px';
export const rawListItemColumnWidth = '80px';
export const rawListPaddingToHoldSpaceForCopyIcon = '25px';

const getStyles = (theme: GrafanaTheme2, totalNumberOfValues: number, isExpandedView: boolean) => ({
  rowWrapper: css({
    borderBottom: `1px solid ${theme.colors.border.medium}`,
    display: 'flex',
    position: 'relative',
    paddingLeft: '22px',
    alignItems: !isExpandedView ? 'center' : '',
    height: !isExpandedView ? '100%' : '',
  }),
  copyToClipboardWrapper: css({
    position: 'absolute',
    left: 0,
    bottom: !isExpandedView ? '0' : '',
    top: isExpandedView ? '4px' : '0',
    margin: 'auto',
    zIndex: 1,
    height: '16px',
    width: '16px',
  }),
  rowLabelWrapWrap: css({
    position: 'relative',
    width: `calc(100% - (${totalNumberOfValues} * ${rawListItemColumnWidth}) - ${rawListPaddingToHoldSpaceForCopyIcon})`,
  }),
  rowLabelWrap: css({
    whiteSpace: 'nowrap',
    overflowX: 'auto',
    MsOverflowStyle: 'none' /* IE and Edge */,
    scrollbarWidth: 'none' /* Firefox */,
    paddingRight: rawListExtraSpaceAtEndOfLine,

    '&::-webkit-scrollbar': {
      display: 'none' /* Chrome, Safari and Opera */,
    },

    '&:after': {
      pointerEvents: 'none',
      content: "''",
      width: '100%',
      height: '100%',
      position: 'absolute',
      left: 0,
      top: 0,
      background: `linear-gradient(to right, transparent calc(100% - ${rawListExtraSpaceAtEndOfLine}), ${theme.colors.background.primary})`,
    },
  }),
});

function getQueryValues(allLabels: Pick<instantQueryRawVirtualizedListData, 'Value' | string | number>) {
  let attributeValues: RawListValue[] = [];
  let values: RawListValue[] = [];
  for (const key in allLabels) {
    if (key in allLabels && allLabels[key] && !key.includes('Value')) {
      attributeValues.push({
        key: key,
        value: allLabels[key],
      });
    } else if (key in allLabels && allLabels[key] && key.includes('Value')) {
      values.push({
        key: key,
        value: allLabels[key],
      });
    }
  }
  return {
    values: values,
    attributeValues: attributeValues,
  };
}

const RawListItem = ({ listItemData, listKey, totalNumberOfValues, valueLabels, isExpandedView }: RawListProps) => {
  const { __name__, ...allLabels } = listItemData;
  // We must know whether it is a utf8 metric name or not
  const isLegacyMetric = isValidLegacyName(__name__);
  const [_, copyToClipboard] = useCopyToClipboard();
  const displayLength = valueLabels?.length ?? totalNumberOfValues;
  const styles = useStyles2(getStyles, displayLength, isExpandedView);

  const { values, attributeValues } = getQueryValues(allLabels);

  /**
   * Transform the symbols in the dataFrame to uniform strings
   */
  const transformCopyValue = (value: string): string => {
    if (value === '∞' || value === 'Infinity') {
      return '+Inf';
    }
    return value;
  };

  // Convert the object back into a string
  const stringRep = `${isLegacyMetric ? __name__ : ''}{${isLegacyMetric ? '' : `"${__name__}", `}${attributeValues.map(
    (value) => {
      // For histograms the string representation currently in this object is not directly queryable in all situations, leading to broken copied queries. Omitting the attribute from the copied result gives a query which returns all le values, which I assume to be a more common use case.
      return `${utf8Support(value.key)}="${transformCopyValue(value.value)}"`;
    }
  )}}`;

  const hideFieldsWithoutValues = Boolean(valueLabels && valueLabels?.length);

  return (
    <>
      {valueLabels !== undefined && isExpandedView && (
        <ItemLabels valueLabels={valueLabels} expanded={isExpandedView} />
      )}
      <div key={listKey} className={styles.rowWrapper}>
        <span className={styles.copyToClipboardWrapper}>
          <IconButton
            tooltip={t('explore.raw-list-item.tooltip-copy-to-clipboard', 'Copy to clipboard')}
            onClick={() => {
              reportInteraction('grafana_explore_prometheus_instant_query_ui_raw_toggle_expand');
              copyToClipboard(stringRep);
            }}
            name="copy"
          />
        </span>
        <span role={'cell'} className={styles.rowLabelWrapWrap}>
          <div className={styles.rowLabelWrap}>
            {isLegacyMetric && <span>{__name__}</span>}
            <span>{`{`}</span>
            {!isLegacyMetric && __name__ !== '' && (
              <span>
                "{__name__}"{', '}
              </span>
            )}
            <span>
              {attributeValues.map((value, index) => (
                <RawListItemAttributes
                  isExpandedView={isExpandedView}
                  value={value}
                  key={index}
                  index={index}
                  length={attributeValues.length}
                />
              ))}
            </span>
            <span>{`}`}</span>
          </div>
        </span>

        {/* Output the values */}
        <ItemValues
          hideFieldsWithoutValues={hideFieldsWithoutValues}
          totalNumberOfValues={displayLength}
          values={values}
        />
      </div>
    </>
  );
};
export default RawListItem;
