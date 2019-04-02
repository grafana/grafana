import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleTable } from './state/actions';
import Table from './Table';
import Panel from './Panel';
import TableModel from 'app/core/table_model';

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

    if (!tableResult) {
      return null;
    }

    return (
      <Panel label="Table" loading={loading} isOpen={showingTable} onToggle={this.onClickTableButton}>
        <Table data={tableResult} loading={loading} onClickCell={onClickCell} />
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { queryTransactions, showingTable, tableResult } = item;
  const loading = queryTransactions.some(qt => qt.resultType === 'Table' && !qt.done);
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
