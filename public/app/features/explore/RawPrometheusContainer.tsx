import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, DataFrame, SelectableValue, SplitOpen, TimeZone, ValueLinkConfig } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import { Collapse, RadioButtonGroup, Table, AdHocFilterItem } from '@grafana/ui';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { StoreState, TABLE_RESULTS_STYLE } from 'app/types';
import { ExploreId, ExploreItemState, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from './MetaInfoText';
import RawListContainer from './PrometheusListView/RawListContainer';
import { getFieldLinksForExplore } from './utils/links';

interface RawPrometheusContainerProps {
  ariaLabel?: string;
  exploreId: ExploreId;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: AdHocFilterItem) => void;
  showRawPrometheus?: boolean;
  splitOpenFn: SplitOpen;
}

interface PrometheusContainerState {
  resultsStyle: TableResultsStyle;
}

function mapStateToProps(state: StoreState, { exploreId }: RawPrometheusContainerProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const { loading: loadingInState, tableResult, rawPrometheusResult, range } = item;
  const rawPrometheusFrame: DataFrame[] = rawPrometheusResult ? [rawPrometheusResult] : [];
  const result = (tableResult?.length ?? false) > 0 && rawPrometheusResult ? tableResult : rawPrometheusFrame;
  const loading = result && result.length > 0 ? false : loadingInState;

  return { loading, tableResult: result, range };
}

const connector = connect(mapStateToProps, {});

type Props = RawPrometheusContainerProps & ConnectedProps<typeof connector>;

export class RawPrometheusContainer extends PureComponent<Props, PrometheusContainerState> {
  constructor(props: Props) {
    super(props);

    // If resultsStyle is undefined we won't render the toggle, and the default table will be rendered
    if (props.showRawPrometheus) {
      this.state = {
        resultsStyle: TABLE_RESULTS_STYLE.raw,
      };
    }
  }

  getMainFrame(frames: DataFrame[] | null) {
    return frames?.find((df) => df.meta?.custom?.parentRowIndex === undefined) || frames?.[0];
  }

  onChangeResultsStyle = (resultsStyle: TableResultsStyle) => {
    this.setState({ resultsStyle });
  };

  getTableHeight() {
    const { tableResult } = this.props;
    const mainFrame = this.getMainFrame(tableResult);

    if (!mainFrame || mainFrame.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, mainFrame.length * 35) + 35);
  }

  renderLabel = () => {
    const spacing = css({
      display: 'flex',
      justifyContent: 'space-between',
    });
    const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<TableResultsStyle>> = TABLE_RESULTS_STYLES.map((style) => ({
      value: style,
      // capital-case it and switch `_` to ` `
      label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
    }));

    return (
      <div className={spacing}>
        {this.state.resultsStyle === TABLE_RESULTS_STYLE.raw ? 'Raw' : 'Table'}
        <RadioButtonGroup
          onClick={() => {
            const props = {
              state:
                this.state.resultsStyle === TABLE_RESULTS_STYLE.table
                  ? TABLE_RESULTS_STYLE.raw
                  : TABLE_RESULTS_STYLE.table,
            };
            reportInteraction('grafana_explore_prometheus_instant_query_ui_toggle_clicked', props);
          }}
          size="sm"
          options={ALL_GRAPH_STYLE_OPTIONS}
          value={this.state?.resultsStyle}
          onChange={this.onChangeResultsStyle}
        />
      </div>
    );
  };

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;

    let dataFrames = tableResult;

    if (dataFrames?.length) {
      dataFrames = applyFieldOverrides({
        data: dataFrames,
        timeZone,
        theme: config.theme2,
        replaceVariables: (v: string) => v,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      });
      // Bit of code smell here. We need to add links here to the frame modifying the frame on every render.
      // Should work fine in essence but still not the ideal way to pass props. In logs container we do this
      // differently and sidestep this getLinks API on a dataframe
      for (const frame of dataFrames) {
        for (const field of frame.fields) {
          field.getLinks = (config: ValueLinkConfig) => {
            return getFieldLinksForExplore({
              field,
              rowIndex: config.valueRowIndex!,
              splitOpenFn,
              range,
              dataFrame: frame!,
            });
          };
        }
      }
    }

    const mainFrame = this.getMainFrame(dataFrames);
    const subFrames = dataFrames?.filter((df) => df.meta?.custom?.parentRowIndex !== undefined);
    const label = this.state?.resultsStyle !== undefined ? this.renderLabel() : 'Table';

    // Render table as default if resultsStyle is not set.
    const renderTable = !this.state?.resultsStyle || this.state?.resultsStyle === TABLE_RESULTS_STYLE.table;

    return (
      <Collapse label={label} loading={loading} isOpen>
        {mainFrame?.length && (
          <>
            {renderTable && (
              <Table
                ariaLabel={ariaLabel}
                data={mainFrame}
                subData={subFrames}
                width={tableWidth}
                height={height}
                onCellFilterAdded={onCellFilterAdded}
              />
            )}
            {this.state?.resultsStyle === TABLE_RESULTS_STYLE.raw && <RawListContainer tableResult={mainFrame} />}
          </>
        )}
        {!mainFrame?.length && <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
      </Collapse>
    );
  }
}

export default connector(RawPrometheusContainer);
