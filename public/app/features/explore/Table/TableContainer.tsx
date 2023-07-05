import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { ValueLinkConfig, applyFieldOverrides, TimeZone, SplitOpen, DataFrame, LoadingState } from '@grafana/data';
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
  getMainFrames(frames: DataFrame[] | null) {
    return (
      frames?.filter((df) => df.meta === undefined || df.meta?.custom?.parentRowIndex === undefined) || [frames?.[0]]
    );
  }

  getTableHeight(frameLength: number, isSingleTable = true) {
    if (frameLength === 0) {
      return 200;
    }
    // tries to estimate table height
    return Math.min(600, Math.max(frameLength * 36, isSingleTable ? 300 : 0) + 40 + 46);
  }

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone } = this.props;

    let dataFrames = tableResult;

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
      });
      // Bit of code smell here. We need to add links here to the frame modifying the frame on every render.
      // Should work fine in essence but still not the ideal way to pass props. In logs container we do this
      // differently and sidestep this getLinks API on a dataframe
      for (const frame of dataFrames) {
        for (const field of frame.fields) {
          field.getLinks = (config: ValueLinkConfig) => {
            return getFieldLinksForExplore({
              field,
              rowIndex: config.valueRowIndex!,
              splitOpenFn,
              range,
              dataFrame: frame!,
            });
          };
        }
      }
    }

    const tableData: Array<{ main: DataFrame; sub?: DataFrame[] }> = [];
    const mainFrames = this.getMainFrames(dataFrames).filter(
      (frame: DataFrame | undefined): frame is DataFrame => !!frame
    );

    /* 
    if there is only one main frame, all other frames are children of that frame's rows

    if there are multiple main frames, there will need to be a matching table key between the main frame and its children
    */
    if (mainFrames?.length === 1) {
      tableData.push({
        main: mainFrames[0],
        sub: dataFrames?.filter((df) => df.meta?.custom?.parentRowIndex !== undefined),
      });
    } else if (mainFrames.length > 1) {
      mainFrames?.forEach((frame) => {
        const subFrames =
          dataFrames?.filter((df) => frame.refId === df.refId && df.meta?.custom?.parentRowIndex !== undefined) || [];
        tableData.push({ main: frame, sub: subFrames.length > 0 ? subFrames : undefined });
      });
    }

    const isNoData = tableData.length === 0 || tableData.find((data) => data.main.length === 0);

    return (
      <>
        {isNoData && <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
        {tableData.length > 0 &&
          tableData.map((data, i) => (
            <PanelChrome
              key={data.main.refId || `table-${i}`}
              title={tableData.length > 1 ? `Table - ${data.main.name || data.main.refId || i}` : 'Table'}
              width={width}
              height={this.getTableHeight(data.main.length, tableData.length === 1)}
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
