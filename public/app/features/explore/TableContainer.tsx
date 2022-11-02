import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { ValueLinkConfig, applyFieldOverrides, TimeZone, SplitOpen } from '@grafana/data';
import { Collapse, Table } from '@grafana/ui';
import { FilterItem } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { StoreState } from 'app/types';
import { ExploreId, ExploreItemState } from 'app/types/explore';

import { MetaInfoText } from './MetaInfoText';
import { getFieldLinksForExplore } from './utils/links';

interface TableContainerProps {
  ariaLabel?: string;
  exploreId: ExploreId;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: FilterItem) => void;
  splitOpenFn: SplitOpen;
}

function mapStateToProps(state: StoreState, { exploreId }: TableContainerProps) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { loading: loadingInState, tableResult, range } = item;
  const loading = tableResult && tableResult.length > 0 ? false : loadingInState;
  return { loading, tableResult, range };
}

const connector = connect(mapStateToProps, {});

type Props = TableContainerProps & ConnectedProps<typeof connector>;

export class TableContainer extends PureComponent<Props> {
  getTableHeight() {
    const { tableResult } = this.props;

    if (!tableResult || tableResult.length === 0) {
      return 200;
    }

    // tries to estimate table height
    return Math.max(Math.min(600, tableResult.length * 35) + 35);
  }

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;
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
            splitOpenFn,
            range,
            dataFrame: dataFrame!,
          });
        };
      }
    }

    return (
      <Collapse label="Table" loading={loading} isOpen>
        {dataFrame?.length ? (
          <Table
            ariaLabel={ariaLabel}
            data={dataFrame}
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

export default connector(TableContainer);
