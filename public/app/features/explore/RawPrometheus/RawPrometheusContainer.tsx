import { css } from '@emotion/css';
import { memo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, DataFrame, SelectableValue, SplitOpen } from '@grafana/data';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { RadioButtonGroup, Table, AdHocFilterItem, PanelChrome } from '@grafana/ui';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { ExploreItemState, TABLE_RESULTS_STYLE, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';
import { StoreState } from 'app/types/store';

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
  const { rawPrometheusResult, range, queryResponse } = item;
  const rawPrometheusFrame: DataFrame[] = rawPrometheusResult ? [rawPrometheusResult] : [];
  const loading = queryResponse.state;

  return { loading, tableResult: rawPrometheusFrame, range };
}

const connector = connect(mapStateToProps, {});

type Props = RawPrometheusContainerProps & ConnectedProps<typeof connector>;

export const RawPrometheusContainer = memo(
  ({
    loading,
    onCellFilterAdded,
    tableResult,
    width,
    splitOpenFn,
    range,
    ariaLabel,
    timeZone,
    showRawPrometheus,
  }: Props) => {
    // If resultsStyle is undefined we won't render the toggle, and the default table will be rendered
    const [resultsStyle, setResultsStyle] = useState<TableResultsStyle | undefined>(
      showRawPrometheus ? TABLE_RESULTS_STYLE.raw : undefined
    );

    const onChangeResultsStyle = (newResultsStyle: TableResultsStyle) => {
      setResultsStyle(newResultsStyle);
    };

    const getTableHeight = () => {
      if (!tableResult || tableResult.length === 0) {
        return 200;
      }

      // tries to estimate table height
      return Math.max(Math.min(600, tableResult[0].length * 35) + 35);
    };

    const renderLabel = () => {
      const spacing = css({
        display: 'flex',
        justifyContent: 'space-between',
        flex: '1',
      });
      const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<TableResultsStyle>> = TABLE_RESULTS_STYLES.map((style) => ({
        value: style,
        // capital-case it and switch `_` to ` `
        label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
      }));

      return (
        <div className={spacing}>
          <RadioButtonGroup
            onClick={() => {
              const props = {
                state: resultsStyle === TABLE_RESULTS_STYLE.table ? TABLE_RESULTS_STYLE.raw : TABLE_RESULTS_STYLE.table,
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
    };

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

    // Render table as default if resultsStyle is not set.
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
  }
);

RawPrometheusContainer.displayName = 'RawPrometheusContainer';

export default connector(RawPrometheusContainer);
