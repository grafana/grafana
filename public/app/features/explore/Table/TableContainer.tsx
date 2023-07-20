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
  hasSubFrames = (data: DataFrame) => data.fields.some((f) => f.config.nested);

  getTableHeight(rowCount: number, hasSubFrames: boolean) {
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
          if (field.config.nested) {
            for (const frame of field.values) {
              for (const valueField of frame.fields) {
                valueField.getLinks = (config: ValueLinkConfig) => {
                  return getFieldLinksForExplore({
                    field: valueField,
                    rowIndex: config.valueRowIndex!,
                    splitOpenFn,
                    range,
                    dataFrame: frame!,
                  });
                };
              }
            }
          } else {
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
    }

    const frames = dataFrames?.filter(
      (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
    );

    return (
      <>
        {frames && frames.length === 0 && (
          <PanelChrome title={'Table'} width={width} height={200}>
            {() => <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
          </PanelChrome>
        )}
        {frames &&
          frames.length > 0 &&
          frames.map((data, i) => (
            <PanelChrome
              key={data.refId || `table-${i}`}
              title={data.length > 1 ? `Table - ${data.name || data.refId || i}` : 'Table'}
              width={width}
              height={this.getTableHeight(data.length, this.hasSubFrames(data))}
              loadingState={loading ? LoadingState.Loading : undefined}
            >
              {(innerWidth, innerHeight) => (
                <Table
                  ariaLabel={ariaLabel}
                  data={data}
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
