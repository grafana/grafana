import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { Collapse, NewTable } from '@grafana/ui';
import { DataFrame } from '@grafana/data';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import { toggleTable } from './state/actions';

interface TableContainerProps {
  exploreId: ExploreId;
  loading: boolean;
  width: number;
  onClickCell: (key: string, value: string) => void;
  showingTable: boolean;
  tableResult?: DataFrame;
  toggleTable: typeof toggleTable;
}

export class TableContainer extends PureComponent<TableContainerProps> {
  onClickTableButton = () => {
    this.props.toggleTable(this.props.exploreId, this.props.showingTable);
  };

  render() {
    const { loading, showingTable, tableResult, width } = this.props;

    const height = 400;

    return (
      <Collapse label="Table" loading={loading} collapsible isOpen={showingTable} onToggle={this.onClickTableButton}>
        {tableResult && <NewTable data={tableResult} width={width} height={height} />}
      </Collapse>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { loading: loadingInState, showingTable, tableResult } = item;
  const loading = tableResult && tableResult.length > 0 ? false : loadingInState;
  return { loading, showingTable, tableResult };
}

const mapDispatchToProps = {
  toggleTable,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TableContainer));
