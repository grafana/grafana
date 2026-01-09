import { memo, useMemo } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DataFrame, SplitOpen } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { AdHocFilterItem } from '@grafana/ui';
import { ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types/store';

import { exploreDataLinkPostProcessorFactory } from '../utils/links';

import { PrometheusQueryResultsContainer } from './PrometheusQueryResultsContainer';

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
 * Gets data from Redux and passes to PrometheusQueryResultsContainer for processing and display.
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

    return (
      <PrometheusQueryResultsContainer
        tableResult={tableResult}
        width={width}
        timeZone={timeZone}
        loading={loading}
        ariaLabel={ariaLabel}
        showRawPrometheus={showRawPrometheus}
        onCellFilterAdded={onCellFilterAdded}
        dataLinkPostProcessor={dataLinkPostProcessor}
      />
    );
  }
);

ExploreRawPrometheusContainer.displayName = 'ExploreRawPrometheusContainer';

// Keep the old export name for backwards compatibility
export const RawPrometheusContainer = ExploreRawPrometheusContainer;

export default connector(ExploreRawPrometheusContainer);
