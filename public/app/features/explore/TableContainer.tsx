import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DataFrame, TimeRange, ValueLinkConfig } from '@grafana/data';
import { Collapse, Table } from '@grafana/ui';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';
import { splitOpen } from './state/actions';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { MetaInfoText } from './MetaInfoText';
import { FilterItem } from '@grafana/ui/src/components/Table/types';
import { getFieldLinksForExplore } from './utils/links';

interface TableContainerProps {
  ariaLabel?: string;
  exploreId: ExploreId;
  loading: boolean;
  width: number;
  onCellFilterAdded?: (filter: FilterItem) => void;
  tableResult?: DataFrame;
  splitOpen: typeof splitOpen;
  range: TimeRange;
}

export class TableContainer extends PureComponent<TableContainerProps> {
  getTableHeight() {
    const { tableResult } = this.props;

    if (!tableResult || tableResult.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, tableResult.length * 35) + 35);
  }

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpen, range, ariaLabel } = this.props;

    const height = this.getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
    const hasTableResult = tableResult?.length;

    if (tableResult && tableResult.length) {
      // Bit of code smell here. We need to add links here to the frame modifying the frame on every render.
      // Should work fine in essence but still not the ideal way to pass props. In logs container we do this
      // differently and sidestep this getLinks API on a dataframe
      for (const field of tableResult.fields) {
        field.getLinks = (config: ValueLinkConfig) => {
          return getFieldLinksForExplore(field, config.valueRowIndex!, splitOpen, range);
        };
      }
    }

    return (
      <Collapse label="Table" loading={loading} isOpen>
        {hasTableResult ? (
          <Table
            ariaLabel={ariaLabel}
            data={tableResult!}
            width={tableWidth}
            height={height}
            onCellFilterAdded={onCellFilterAdded}
          />
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
  const { loading: loadingInState, tableResult, range } = item;
  const loading = tableResult && tableResult.length > 0 ? false : loadingInState;
  return { loading, tableResult, range };
}

const mapDispatchToProps = {
  splitOpen,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(TableContainer));
