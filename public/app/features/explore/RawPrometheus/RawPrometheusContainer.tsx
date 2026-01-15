import { cloneDeep } from 'lodash';
import { memo, useMemo } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, DataFrame, SplitOpen } from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { AdHocFilterItem } from '@grafana/ui';
import { ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types/store';

import { exploreDataLinkPostProcessorFactory } from '../utils/links';

import { RawPrometheusContainerPure } from './RawPrometheusContainerPure';

// ============================================================================
// Redux-connected Component - Used by Explore
// ============================================================================

interface ExploreRawPrometheusContainerProps {
  ariaLabel?: string;
  exploreId: string;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: AdHocFilterItem) => void;
  showRawPrometheus?: boolean;
  splitOpenFn?: SplitOpen;
}

function mapStateToProps(state: StoreState, { exploreId }: ExploreRawPrometheusContainerProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const { rawPrometheusResult, range, queryResponse } = item;
  const rawPrometheusFrame: DataFrame[] = rawPrometheusResult ? [rawPrometheusResult] : [];
  const loading = queryResponse.state;

  return { loading, tableResult: rawPrometheusFrame, range };
}

const connector = connect(mapStateToProps, {});

type ExploreProps = ExploreRawPrometheusContainerProps & ConnectedProps<typeof connector>;

/**
 * Redux-connected wrapper for Explore.
 * Gets data from Redux, processes it with field overrides, and passes to RawPrometheusContainerPure for display.
 */
const ExploreRawPrometheusContainer = memo(
  ({
    loading,
    onCellFilterAdded,
    tableResult,
    width,
    ariaLabel,
    timeZone,
    showRawPrometheus,
    range,
    splitOpenFn,
  }: ExploreProps) => {
    const dataLinkPostProcessor = useMemo(
      () => exploreDataLinkPostProcessorFactory(splitOpenFn, range),
      [splitOpenFn, range]
    );

    // Process data with field overrides (memoized)
    const processedData = useMemo(() => {
      if (!tableResult?.length) {
        return tableResult;
      }
      // Clone to avoid mutating frozen Redux state
      const cloned = cloneDeep(tableResult);
      return applyFieldOverrides({
        data: cloned,
        timeZone: timeZone ?? 'browser',
        theme: config.theme2,
        replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        fieldConfig: { defaults: {}, overrides: [] },
        dataLinkPostProcessor,
      });
    }, [tableResult, timeZone, dataLinkPostProcessor]);

    return (
      <RawPrometheusContainerPure
        tableResult={processedData}
        width={width}
        loading={loading}
        ariaLabel={ariaLabel}
        showRawPrometheus={showRawPrometheus}
        onCellFilterAdded={onCellFilterAdded}
      />
    );
  }
);

ExploreRawPrometheusContainer.displayName = 'ExploreRawPrometheusContainer';

// Keep the old export name for backwards compatibility
export const RawPrometheusContainer = ExploreRawPrometheusContainer;

export default connector(ExploreRawPrometheusContainer);
