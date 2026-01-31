import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
import { VariableSizeList as List } from 'react-window';

import { DataFrame } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Field, Switch } from '@grafana/ui';

import { ItemLabels } from './ItemLabels';
import RawListItem from './RawListItem';
import {
  getRawPrometheusListItemsFromDataFrame,
  RawPrometheusListItemEmptyValue,
} from './utils/getRawPrometheusListItemsFromDataFrame';

export type instantQueryRawVirtualizedListData = {
  Value: string;
  __name__?: string;
  [index: string]: string | undefined;
};

export interface RawListContainerProps {
  tableResult: DataFrame;
  /** Optional default expanded state. If undefined, uses responsive default based on screen width and column count. */
  defaultExpanded?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

const styles = {
  wrapper: css({
    height: '100%',
    overflow: 'scroll',
  }),
  switchWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 0,
  }),
  switchLabel: css({
    marginLeft: '15px',
    marginBottom: 0,
  }),
  switch: css({
    marginLeft: '10px',
  }),
  resultCount: css({
    marginBottom: '4px',
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    fontSize: '12px',
    lineHeight: 1.25,
  }),
};

const mobileWidthThreshold = 480;
const numberOfColumnsBeforeExpandedViewIsDefault = 2;

/**
 * The container that provides the virtualized list to the child components
 * @param props
 * @constructor
 */
const RawListContainer = (props: RawListContainerProps) => {
  const { tableResult, defaultExpanded, ariaLabel } = props;
  const listRef = useRef<List | null>(null);

  // Memoize expensive data processing to avoid cloneDeep on every render
  const { valueLabels, items } = useMemo(() => {
    const dataFrame = cloneDeep(tableResult);
    const valueLabels = dataFrame.fields.filter((field) => field.name.includes('Value'));
    const items = getRawPrometheusListItemsFromDataFrame(dataFrame);
    return { valueLabels, items };
  }, [tableResult]);

  // Pre-compute filtered value labels for each item to avoid creating new arrays in render
  const filteredValueLabelsPerItem = useMemo(() => {
    return items.map((item) =>
      valueLabels.filter((valueLabel) => {
        const itemWithValue = item[valueLabel.name];
        return itemWithValue && itemWithValue !== RawPrometheusListItemEmptyValue;
      })
    );
  }, [items, valueLabels]);

  const { width } = useWindowSize();
  const [isExpandedView, setIsExpandedView] = useState(
    defaultExpanded ??
      (width <= mobileWidthThreshold || valueLabels.length > numberOfColumnsBeforeExpandedViewIsDefault)
  );

  const onContentClick = () => {
    setIsExpandedView(!isExpandedView);
    const props = {
      isExpanded: !isExpandedView,
    };
    reportInteraction('grafana_explore_prometheus_instant_query_ui_raw_toggle_expand', props);
  };

  useEffect(() => {
    // After the expanded view has updated, tell the list to re-render
    listRef.current?.resetAfterIndex(0, true);
  }, [isExpandedView]);

  const calculateInitialHeight = (length: number): number => {
    const maxListHeight = 600;
    const shortListLength = 10;

    if (length < shortListLength) {
      let sum = 0;
      for (let i = 0; i < length; i++) {
        sum += getListItemHeight(i, true);
      }

      return Math.min(maxListHeight, sum);
    }

    return maxListHeight;
  };

  const getListItemHeight = (itemIndex: number, isExpandedView: boolean) => {
    const singleLineHeight = 32;
    const additionalLineHeight = 22;
    if (!isExpandedView) {
      return singleLineHeight;
    }
    const item = items[itemIndex];

    // Height of 1.5 lines, plus the number of non-value attributes times the height of additional lines
    return 1.5 * singleLineHeight + (Object.keys(item).length - valueLabels.length) * additionalLineHeight;
  };

  const switchId = `isExpandedView ${useId()}`;

  return (
    <section aria-label={ariaLabel}>
      <header className={styles.header}>
        <Field
          className={styles.switchWrapper}
          label={t('explore.raw-list-container.label-expand-results', 'Expand results')}
          htmlFor={'isExpandedView'}
          noMargin
        >
          <div className={styles.switch}>
            <Switch
              onChange={onContentClick}
              id={switchId}
              value={isExpandedView}
              label={t('explore.raw-list-container.label-expand-results', 'Expand results')}
            />
          </div>
        </Field>

        <div className={styles.resultCount}>
          <Trans i18nKey="explore.raw-list-container.item-count" values={{ numItems: items.length }}>
            Result series: {'{{numItems}}'}
          </Trans>
        </div>
      </header>

      <div role={'table'}>
        {
          <>
            {/* Show the value headings above all the values, but only if we're in the contracted view */}
            {valueLabels.length > 1 && !isExpandedView && (
              <ItemLabels valueLabels={valueLabels} expanded={isExpandedView} />
            )}
            <List
              ref={listRef}
              itemCount={items.length}
              className={styles.wrapper}
              itemSize={(index) => getListItemHeight(index, isExpandedView)}
              height={calculateInitialHeight(items.length)}
              width="100%"
            >
              {({ index, style }) => (
                <div role="row" style={{ ...style, overflow: 'hidden' }}>
                  <RawListItem
                    isExpandedView={isExpandedView}
                    valueLabels={isExpandedView ? filteredValueLabelsPerItem[index] : undefined}
                    totalNumberOfValues={valueLabels.length}
                    listKey={items[index].__name__ || `item-${index}`}
                    listItemData={items[index]}
                  />
                </div>
              )}
            </List>
          </>
        }
      </div>
    </section>
  );
};

export default RawListContainer;
