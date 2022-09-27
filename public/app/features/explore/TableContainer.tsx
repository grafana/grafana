import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { VariableSizeList as List } from 'react-window';

import {
  applyFieldOverrides,
  DataFrame,
  formattedValueToString,
  SelectableValue,
  TimeZone,
  ValueLinkConfig,
} from '@grafana/data';
import { Collapse, RadioButtonGroup, stylesFactory, Table } from '@grafana/ui';
import { FilterItem } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import {StoreState, TABLE_RESULTS_STYLE} from 'app/types';
import { ExploreId, ExploreItemState, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from './MetaInfoText';
import { RawList } from './RawList';
import { splitOpen } from './state/main';
import { getFieldLinksForExplore } from './utils/links';

interface TableContainerProps {
  ariaLabel?: string;
  exploreId: ExploreId;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: FilterItem) => void;
}

interface TableContainerState {
  resultsStyle: TableResultsStyle;
}

export type instantQueryRawVirtualizedListData = {Value: string, __name__: string, [index: string]: string};
type instantQueryMetricList = { [index: string]: { [index: string]: {[index: string]: string, Value: string} } };

function mapStateToProps(state: StoreState, { exploreId }: TableContainerProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId] as ExploreItemState;
  const { loading: loadingInState, tableResult, range } = item;
  const loading = tableResult && tableResult.length > 0 ? false : loadingInState;
  return { loading, tableResult, range };
}

const mapDispatchToProps = {
  splitOpen,
};

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      height: 100%;
      overflow: scroll;
    `,
  };
});

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = TableContainerProps & ConnectedProps<typeof connector>;

export class TableContainer extends PureComponent<Props, TableContainerState> {
  private styles: ReturnType<
    () => {
    //@todo delete extra markup after we know what we need to target
      wrapper: string;
    }
  >;

  constructor(props: Props) {
    super(props);
    this.state = {
      resultsStyle: TABLE_RESULTS_STYLE.raw,
    };
    this.styles = getStyles();
  }

  onChangeResultsStyle = (resultsStyle: TableResultsStyle) => {
    this.setState({ resultsStyle });
  };

  getTableHeight() {
    const { tableResult } = this.props;

    if (!tableResult || tableResult.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, tableResult.length * 35) + 35);
  }
  //@todo refactor this
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
          size="sm"
          options={ALL_GRAPH_STYLE_OPTIONS}
          value={this.state.resultsStyle}
          onChange={this.onChangeResultsStyle}
        />
      </div>
    );
  };

  estimateItemSize = (): number => {
    const width = window.innerWidth;
    if(width <= 320) {return 200;}
    if(width <= 720) {return 140}

    return 80;
  }

  renderTable = () => {
    const { onCellFilterAdded, tableResult, width, splitOpen, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
    let dataFrame = cloneDeep(tableResult);

    if (dataFrame?.length && dataFrame) {
      if (this.state.resultsStyle === TABLE_RESULTS_STYLE.raw) {
        // const olditems = this.getListItemsFromDataFrame(dataFrame);
        const items = this.getListItemsFromDataFrameNew(dataFrame);

        return (
          <>
            {/* @todo temporarily borrowing this from the prometheus API for debugging, review with UX */}
            <div>Result series: {items.length}</div>

            {/* @todo these are arbitrary numbers */}
            <List
              itemCount={items.length}
              className={this.styles.wrapper}
              itemSize={(index: number) => {
                return 42;
              }}
              height={600}
              width="100%"
            >
              {({ index, style }) => (
                <div style={{ ...style, overflow: 'hidden' }}>
                  <RawList listKey={index} listItemData={items[index]} />
                </div>
              )}
            </List>
          </>
        );
      }

      dataFrame = applyFieldOverrides({
        data: [dataFrame],
        timeZone,
        theme: config.theme2,
        replaceVariables: (v: string) => v,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })[0];
      // Bit of code smell here. We need to add links here to the frame modifying the frame on every render.
      // Should work fine in essence but still not the ideal way to pass props. In logs container we do this
      // differently and sidestep this getLinks API on a dataframe
      for (const field of dataFrame.fields) {
        field.getLinks = (config: ValueLinkConfig) => {
          return getFieldLinksForExplore({
            field,
            rowIndex: config.valueRowIndex!,
            splitOpenFn: splitOpen,
            range,
            dataFrame: dataFrame!,
          });
        };
      }

      return (
        <Table
          ariaLabel={ariaLabel}
          data={dataFrame}
          width={tableWidth}
          height={height}
          onCellFilterAdded={onCellFilterAdded}
        />
      );
    }

    return <MetaInfoText metaItems={[{ value: '0 series returned' }]} />;
  };


  /**
   * Prepare dataframe for consumption by virtualized list component
   * @param dataFrame
   * @private
   */
  private getListItemsFromDataFrameNew(dataFrame: DataFrame): instantQueryRawVirtualizedListData[] {
    const metricList: instantQueryMetricList = {};
    const outputList: instantQueryRawVirtualizedListData[] = [];

    // Filter out time
    const newFields = dataFrame.fields.filter((field) => !['Time'].includes(field.name));

    // Get name from each series
    const metricNames: string[] = newFields.find((field) => ['__name__'].includes(field.name))?.values?.toArray() ?? [];

    // Get everything that isn't the name from each series
    const metricLabels = dataFrame.fields.filter((field) => !['__name__'].includes(field.name));

    metricNames.forEach(function (metric: string, i: number) {
      metricList[metric] = {};
      metricList[metric][i] = {} as instantQueryRawVirtualizedListData;
      for (const field of metricLabels) {
        const label = field.name;

        if (label !== 'Time') {
          // Initialize the objects
          if (typeof field?.display === 'function') {
            const stringValue = formattedValueToString(field?.display(field.values.get(i)));
            if (stringValue) {
              metricList[metric][i][label] = stringValue;
            }
          } else {
            console.warn('Field display method is missing!');
          }
        }
      }

      outputList.push({
        ...metricList[metric][i],
        __name__: metric,
      })
    });

    return outputList;
  }

  render() {
    const { loading } = this.props;
    const label = this.renderLabel();

    return (
      <Collapse label={label} loading={loading} isOpen>
        {this.renderTable()}
      </Collapse>
    );
  }
}

export default connector(TableContainer);
