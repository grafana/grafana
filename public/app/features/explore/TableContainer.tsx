import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { ValueLinkConfig, applyFieldOverrides, TimeZone, SelectableValue, formattedValueToString } from '@grafana/data';
import { Collapse, Table, RadioButtonGroup, List } from '@grafana/ui';
import { FilterItem } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { StoreState } from 'app/types';
import { ExploreId, ExploreItemState, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from './MetaInfoText';
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

function mapStateToProps(state: StoreState, { exploreId }: TableContainerProps) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { loading: loadingInState, tableResult, range } = item;
  const loading = tableResult && tableResult.length > 0 ? false : loadingInState;
  return { loading, tableResult, range };
}

const mapDispatchToProps = {
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = TableContainerProps & ConnectedProps<typeof connector>;

export class TableContainer extends PureComponent<Props, TableContainerState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      resultsStyle: 'default',
    };
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

  // TODO: Properly type and remove all current @ts-ignore
  // @ts-ignore
  renderListItem = ([metric, { Value, ...AllLabels }]) => {
    // @ts-ignore
    let values: [] = []; // @ts-ignore
    for (const key in AllLabels) {
      if (Object.prototype.hasOwnProperty.call(AllLabels, key)) {
        const label = `${key}="${AllLabels[key]}"`;
        // @ts-ignore
        values = [...values, label];
      }
    }

    return (
      <>
        {metric}
        {`{${values.join(', ')}} `}
        {Value}
      </>
    );
  };

  renderTable = () => {
    const { onCellFilterAdded, tableResult, width, splitOpen, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
    let dataFrame = cloneDeep(tableResult);

    if (dataFrame?.length) {
      if (this.state.resultsStyle === 'default') {
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
      } else {
        // @ts-ignore
        let metricList = {};
        dataFrame.fields = dataFrame.fields.filter((field) => !['Time'].includes(field.name));
        const metricNames =
          dataFrame.fields.find((field) => ['__name__'].includes(field.name))?.values?.toArray() ?? [];
        const metricLabels = dataFrame.fields.filter((field) => !['__name__'].includes(field.name));
        metricNames.forEach(function (metric, i) {
          // @ts-ignore
          metricList[metric] = {};
          for (const field of metricLabels) {
            const label = field.name;
            const value = formattedValueToString(field.display!(field.values.get(i)));

            // @ts-ignore
            metricList[metric][label] = value;
          }
        });
        const items = Object.entries(metricList);

        // @ts-ignore
        return <List items={items} renderItem={this.renderListItem} getItemKey={(item) => item[0]} />;
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
