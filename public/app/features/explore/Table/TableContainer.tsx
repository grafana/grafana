import { css } from '@emotion/css';
import React, { useState, useCallback } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, DataFrame, SelectableValue, SplitOpen } from '@grafana/data';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { RadioButtonGroup, Table, AdHocFilterItem, PanelChrome } from '@grafana/ui';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { StoreState, TABLE_RESULTS_STYLE } from 'app/types';
import { ExploreItemState, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from '../MetaInfoText';
import RawListContainer from '../PrometheusListView/RawListContainer';
import { exploreDataLinkPostProcessorFactory } from '../utils/links';

interface RawPrometheusContainerProps {
  ariaLabel?: string;
  exploreId: string;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: AdHocFilterItem) => void;
  showRawPrometheus?: boolean;
  splitOpenFn: SplitOpen;
}

function mapStateToProps(state: StoreState, { exploreId }: RawPrometheusContainerProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const { tableResult, rawPrometheusResult, range, queryResponse } = item;
  const rawPrometheusFrame: DataFrame[] = rawPrometheusResult ? [rawPrometheusResult] : [];
  const result = (tableResult?.length ?? 0) > 0 && rawPrometheusResult ? tableResult : rawPrometheusFrame;
  const loading = queryResponse.state;

  return { loading, tableResult: result, range };
}

const connector = connect(mapStateToProps, {});

type Props = RawPrometheusContainerProps & ConnectedProps<typeof connector>;

const RawPrometheusContainer: React.FC<Props> = ({
  ariaLabel,
  exploreId,
  width,
  timeZone,
  onCellFilterAdded,
  showRawPrometheus,
  splitOpenFn,
  loading,
  tableResult,
  range,
}) => {
  const [resultsStyle, setResultsStyle] = useState<TableResultsStyle>(
    showRawPrometheus ? TABLE_RESULTS_STYLE.raw : undefined
  );

  const onChangeResultsStyle = useCallback((style: TableResultsStyle) => {
    setResultsStyle(style);
  }, []);

  const getTableHeight = useCallback(() => {
    if (!tableResult || tableResult.length === 0) {
      return 200;
    }

    return Math.max(Math.min(600, tableResult[0].length * 35) + 35);
  }, [tableResult]);

  const renderLabel = useCallback(() => {
    const spacing = css({
      display: 'flex',
      justifyContent: 'space-between',
      flex: '1',
    });

    const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<TableResultsStyle>> = TABLE_RESULTS_STYLES.map((style) => ({
      value: style,
      label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
    }));

    return (
      <div className={spacing}>
        <RadioButtonGroup
          onClick={() => {
            const props = {
              state:
                resultsStyle === TABLE_RESULTS_STYLE.table
                  ? TABLE_RESULTS_STYLE.raw
                  : TABLE_RESULTS_STYLE.table,
            };
            reportInteraction('grafana_explore_prometheus_instant_query_ui_toggle_clicked', props);
          }}
          size="sm"
          options={ALL_GRAPH_STYLE_OPTIONS}
          value={resultsStyle}
          onChange={onChangeResultsStyle}
        />
      </div>
    );
  }, [resultsStyle, onChangeResultsStyle]);

  const height = getTableHeight();
  const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;

  let dataFrames = tableResult;

  const dataLinkPostProcessor = exploreDataLinkPostProcessorFactory(splitOpenFn, range);

  if (dataFrames?.length) {
    dataFrames = applyFieldOverrides({
      data: dataFrames,
      timeZone,
      theme: config.theme2,
      replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      dataLinkPostProcessor,
    });
  }

  const frames = dataFrames?.filter(
    (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
  );

  const title = resultsStyle === TABLE_RESULTS_STYLE.raw ? 'Raw' : 'Table';
  const label = resultsStyle !== undefined ? renderLabel() : 'Table';

  const renderTable = !resultsStyle || resultsStyle === TABLE_RESULTS_STYLE.table;

  return (
    <PanelChrome title={title} actions={label} loadingState={loading}>
      {frames?.length && (
        <>
          {renderTable && (
            <Table
              ariaLabel={ariaLabel}
              data={frames[0]}
              width={tableWidth}
              height={height}
              onCellFilterAdded={onCellFilterAdded}
            />
          )}
          {resultsStyle === TABLE_RESULTS_STYLE.raw && <RawListContainer tableResult={frames[0]} />}
        </>
      )}
      {!frames?.length && <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
    </PanelChrome>
  );
};

export default connector(RawPrometheusContainer);
