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
import { StoreState } from 'app/types';
import { ExploreId, ExploreItemState, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from './MetaInfoText';
import { splitOpen } from './state/main';
import { getFieldLinksForExplore } from './utils/links';
import { RawList } from './RawList';

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
    rowsWrapper: css`
      width: 100%;
    `,

    rowWrapper: css`
      border-bottom:1px solid #ccc;
      display: flex;
      justify-content: space-between;
      padding:10px 6px;
    `,
    rowLabelWrap: css`
      display: flex;
    `,
    rowHeading: css`
      color: green;
    `,
    rowValue: css``,
    rowContent: css``,
    metricName: css`
      /* @todo replace mockup styles */
      color: red;
    `,
    metricEquals: css``,
    metricQuote: css``,
    metricValue: css`
      /* @todo replace mockup styles */
      font-weight: bold;
    `,
  };
});

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = TableContainerProps & ConnectedProps<typeof connector>;
// type ListItem = [string, { [index: string]: string; Value: string }];

export class TableContainer extends PureComponent<Props, TableContainerState> {
  private styles: ReturnType<
    () => {
      rowsWrapper: string;
      wrapper: string;
      rowWrapper: string;
      rowLabelWrap: string;
      rowHeading: string;
      rowValue: string;
      rowContent: string;
      metricName: string;
      metricEquals: string;
      metricQuote: string;
      metricValue: string;
    }
  >;

  constructor(props: Props) {
    super(props);
    this.state = {
      resultsStyle: 'raw',
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
        {this.state.resultsStyle === 'raw' ? 'Raw' : 'Table'}
        <RadioButtonGroup
          size="sm"
          options={ALL_GRAPH_STYLE_OPTIONS}
          value={this.state.resultsStyle}
          onChange={this.onChangeResultsStyle}
        />
      </div>
    );
  };

  renderTable = () => {
    const { onCellFilterAdded, tableResult, width, splitOpen, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
    let dataFrame = cloneDeep(tableResult);

    if (dataFrame?.length && dataFrame) {
      if (this.state.resultsStyle === 'raw') {
        const items = this.getListItemsFromDataFrame(dataFrame);

        return (
          <>
            {/* @todo temporarily borrowing this from the prometheus API for debugging, remove? */}
            <div>Result series: {items.length}</div>

            {/* @todo these are arbitrary numbers */}
            <List
              itemCount={items.length}
              className={this.styles.wrapper}
              itemSize={(index: number) => {
                return 42;
              }}
              estimatedItemSize={42}
              height={600}
              width="100%"
            >
              {({ index, style }) => (
                <div style={{ ...style, overflow: 'hidden' }}>
                  {/* @ts-ignore */}
                  <RawList listItemData={items[index]} />
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
   * @todo looks like this is only returning a single value for each series instead of the default prom behavior
   * @param dataFrame
   * @private
   */
  private getListItemsFromDataFrame(dataFrame: DataFrame) {
    let metricList: { [index: string]: { [index: string]: string } } = {};

    // Filter out time
    const newFields = dataFrame.fields.filter((field) => !['Time'].includes(field.name));

    const metricNames: string[] = newFields.find((field) => ['__name__'].includes(field.name))?.values?.toArray() ?? [];

    const metricLabels = dataFrame.fields.filter((field) => !['__name__'].includes(field.name));

    metricNames.forEach(function (metric: string, i: number) {
      for (const field of metricLabels) {
        const label = field.name;
        if (metric && metricList[metric] === undefined) {
          metricList[metric] = {};
        }

        if(label !== 'Time'){
          //@ts-ignore
          const stringValue = formattedValueToString(field?.display(field.values.get(i)));
          if(stringValue){
            metricList[metric][label] = stringValue;
          }
        }
      }
    });

    return Object.entries(metricList);
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
