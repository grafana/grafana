import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, TimeZone, SplitOpen, DataFrame, LoadingState } from '@grafana/data';
import { Table, AdHocFilterItem, PanelChrome } from '@grafana/ui';
import { config } from 'app/core/config';
import { StoreState } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import { MetaInfoText } from '../MetaInfoText';
import { selectIsWaitingForData } from '../state/query';
import { exploreDataLinkPostProcessorFactory } from '../utils/links';

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
  getMainFrames(frames: DataFrame[] | null) {
    return frames?.filter((df) => df.meta?.custom?.parentRowIndex === undefined) || [frames?.[0]];
  }

  getTableHeight(rowCount: number, hasSubFrames = true) {
    if (rowCount === 0) {
      return 200;
    }
    // tries to estimate table height, with a min of 300 and a max of 600
    // if there are multiple tables, there is no min
    return Math.min(600, Math.max(rowCount * 36, hasSubFrames ? 300 : 0) + 40 + 46);
  }

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;

    let dataFrames = tableResult;

    const dataLinkPostProcessor = exploreDataLinkPostProcessorFactory(splitOpenFn, range);

    if (dataFrames?.length) {
      dataFrames = applyFieldOverrides({
        data: dataFrames,
        timeZone,
        theme: config.theme2,
        replaceVariables: (v: string) => v,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        dataLinkPostProcessor,
      });
    }

    // move dataframes to be grouped by table, with optional sub-tables for a row
    const tableData: Array<{ main: DataFrame; sub?: DataFrame[] }> = [];
    const mainFrames = this.getMainFrames(dataFrames).filter(
      (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
    );

    mainFrames?.forEach((frame) => {
      const subFrames =
        dataFrames?.filter((df) => frame.refId === df.refId && df.meta?.custom?.parentRowIndex !== undefined) ||
        undefined;
      tableData.push({ main: frame, sub: subFrames });
    });

    return (
      <>
        {tableData.length === 0 && (
          <PanelChrome title={'Table'} width={width} height={200}>
            {() => <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
          </PanelChrome>
        )}
        {tableData.length > 0 &&
          tableData.map((data, i) => (
            <PanelChrome
              key={data.main.refId || `table-${i}`}
              title={tableData.length > 1 ? `Table - ${data.main.name || data.main.refId || i}` : 'Table'}
              width={width}
              height={this.getTableHeight(data.main.length, (data.sub?.length || 0) > 0)}
              loadingState={loading ? LoadingState.Loading : undefined}
            >
              {(innerWidth, innerHeight) => (
                <Table
                  ariaLabel={ariaLabel}
                  data={data.main}
                  subData={data.sub}
                  width={innerWidth}
                  height={innerHeight}
                  onCellFilterAdded={onCellFilterAdded}
                />
              )}
            </PanelChrome>
          ))}
      </>
    );
  }
}

export default connector(TableContainer);
