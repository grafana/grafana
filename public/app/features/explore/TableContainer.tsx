import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Collapse } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleTable } from './state/actions';
import Table from './Table';
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

    return (
      <Collapse label="Table" loading={loading} collapsible isOpen={showingTable} onToggle={this.onClickTableButton}>
        {tableResult && <Table data={tableResult} loading={loading} onClickCell={onClickCell} />}
      </Collapse>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { loading: loadingInState, showingTable, tableResult } = item;
  const loading = tableResult && tableResult.rows.length > 0 ? false : loadingInState;
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
