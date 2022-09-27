import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, SelectableValue, TimeZone, ValueLinkConfig } from '@grafana/data';
import { Collapse, RadioButtonGroup, Table } from '@grafana/ui';
import { FilterItem } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { StoreState, TABLE_RESULTS_STYLE } from 'app/types';
import { ExploreId, ExploreItemState, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from './MetaInfoText';
import RawListContainer from './RawListContainer';
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
  const item: ExploreItemState = explore[exploreId] as ExploreItemState;
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
      resultsStyle: TABLE_RESULTS_STYLE.raw,
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

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpen, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;

    let dataFrame = tableResult;

    if (dataFrame?.length) {
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
    }

    const label = this.renderLabel();

    return (
      <Collapse label={label} loading={loading} isOpen>
        {dataFrame?.length && this.state.resultsStyle === TABLE_RESULTS_STYLE.table && (
          <Table
            ariaLabel={ariaLabel}
            data={dataFrame}
            width={tableWidth}
            height={height}
            onCellFilterAdded={onCellFilterAdded}
          />
        )}

        {dataFrame?.length && this.state.resultsStyle === TABLE_RESULTS_STYLE.raw && (
          <RawListContainer tableResult={dataFrame} />
        )}

        {!dataFrame?.length && <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
      </Collapse>
    );
  }
}

export default connector(TableContainer);
