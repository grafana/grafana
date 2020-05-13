import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DataFrame } from '@grafana/data';
import { Table, Collapse } from '@grafana/ui';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import { toggleTable } from './state/actions';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { MetaInfoText } from './MetaInfoText';

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

  getTableHeight() {
    const { tableResult } = this.props;

    if (!tableResult || tableResult.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, tableResult.length * 35) + 35);
  }

  render() {
    const { loading, onClickCell, showingTable, tableResult, width } = this.props;

    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
    const hasTableResult = tableResult?.length;

    return (
      <Collapse label="Table" loading={loading} collapsible isOpen={showingTable} onToggle={this.onClickTableButton}>
        {hasTableResult ? (
          <Table data={tableResult!} width={tableWidth} height={height} onCellClick={onClickCell} />
        ) : (
          <MetaInfoText metaItems={[{ value: '0 series returned' }]} />
        )}
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
