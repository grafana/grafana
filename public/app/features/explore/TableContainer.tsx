import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleTable } from './state/actions';
import Table from './Table';
import Panel from './Panel';
import TableModel from 'app/core/table_model';
import { LoadingState } from '@grafana/ui';

interface TableContainerProps {
  exploreId: ExploreId;
  loading: boolean;
  onClickCell: (key: string, value: string) => void;
  showingTable: boolean;
  tableResult?: TableModel;
  toggleTable: typeof toggleTable;
}

export class TableContainer extends PureComponent<TableContainerProps> {
  onClickTableButton = () => {
    this.props.toggleTable(this.props.exploreId, this.props.showingTable);
  };

  render() {
    const { loading, onClickCell, showingTable, tableResult } = this.props;

    return (
      <Panel label="Table" loading={loading} collapsible isOpen={showingTable} onToggle={this.onClickTableButton}>
        {tableResult && <Table data={tableResult} loading={loading} onClickCell={onClickCell} />}
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { loadingState, showingTable, tableResult } = item;
  const loading =
    tableResult && tableResult.rows.length > 0
      ? false
      : loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;
  return { loading, showingTable, tableResult };
}

const mapDispatchToProps = {
  toggleTable,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(TableContainer)
);
