import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { ValueLinkConfig, applyFieldOverrides, TimeZone, SplitOpen, LoadingState, DataFrame } from '@grafana/data';
import { Table, AdHocFilterItem, PanelChrome } from '@grafana/ui';
import { config } from 'app/core/config';
import { StoreState } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import { MetaInfoText } from '../MetaInfoText';
import { selectIsWaitingForData } from '../state/query';
import { getFieldLinksForExplore } from '../utils/links';

interface TableContainerProps {
  ariaLabel?: string;
  exploreId: string;
  width: number;
  timeZone: TimeZone;
  onCellFilterAdded?: (filter: AdHocFilterItem) => void;
  splitOpenFn: SplitOpen;
}

function mapStateToProps(state: StoreState, { exploreId }: TableContainerProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const { tableResult, range } = item;
  const loadingInState = selectIsWaitingForData(exploreId);
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
    return Math.min(600, Math.max(tableResult.length * 36, 300) + 40 + 46);
  }

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;
    const height = this.getTableHeight();

    let dataFrame: DataFrame | null = null;

    if (tableResult?.length) {
      dataFrame = applyFieldOverrides({
        data: tableResult,
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
      <PanelChrome
        title="Table"
        width={width}
        height={height}
        loadingState={loading ? LoadingState.Loading : undefined}
      >
        {(innerWidth, innerHeight) => (
          <>
            {dataFrame?.length ? (
              <Table
                ariaLabel={ariaLabel}
                data={dataFrame}
                width={innerWidth}
                height={innerHeight}
                onCellFilterAdded={onCellFilterAdded}
              />
            ) : (
              <MetaInfoText metaItems={[{ value: '0 series returned' }]} />
            )}
          </>
        )}
      </PanelChrome>
    );
  }
}

export default connector(TableContainer);
