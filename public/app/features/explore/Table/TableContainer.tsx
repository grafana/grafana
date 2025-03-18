import { css } from '@emotion/css';
import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { applyFieldOverrides, SplitOpen, DataFrame, LoadingState, FieldType } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Table, AdHocFilterItem, PanelChrome, withTheme2, Themeable2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { t } from 'app/core/internationalization';
import {
  hasDeprecatedParentRowIndex,
  migrateFromParentRowIndexToNestedFrames,
} from 'app/plugins/panel/table/migrations';
import { StoreState } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import { MetaInfoText } from '../MetaInfoText';
import { selectIsWaitingForData } from '../state/query';
import { exploreDataLinkPostProcessorFactory } from '../utils/links';

interface TableContainerProps extends Themeable2 {
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
  hasSubFrames = (data: DataFrame) => data.fields.some((f) => f.type === FieldType.nestedFrames);

  getTableHeight(rowCount: number, hasSubFrames: boolean) {
    if (rowCount === 0) {
      return 200;
    }
    // tries to estimate table height, with a min of 300 and a max of 600
    // if there are multiple tables, there is no min
    return Math.min(600, Math.max(rowCount * 36, hasSubFrames ? 300 : 0) + 40 + 46);
  }

  getTableTitle(dataFrames: DataFrame[] | null, data: DataFrame, i: number) {
    let name = data.name;
    if (!name && (dataFrames?.length ?? 0) > 1) {
      name = data.refId || `${i}`;
    }

    return name
      ? t('explore.table.title-with-name', 'Table - {{name}}', { name, interpolation: { escapeValue: false } })
      : t('explore.table.title', 'Table');
  }

  render() {
    const { loading, onCellFilterAdded, tableResult, width, splitOpenFn, range, ariaLabel, timeZone, theme } =
      this.props;

    let dataFrames = hasDeprecatedParentRowIndex(tableResult)
      ? migrateFromParentRowIndexToNestedFrames(tableResult)
      : tableResult;
    const dataLinkPostProcessor = exploreDataLinkPostProcessorFactory(splitOpenFn, range);

    if (dataFrames?.length) {
      dataFrames = applyFieldOverrides({
        data: dataFrames,
        timeZone,
        theme: config.theme2,
        replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        dataLinkPostProcessor,
      });
    }

    const frames = dataFrames?.filter(
      (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
    );

    return (
      <>
        {frames && frames.length === 0 && (
          <PanelChrome title={t('explore.table.title', 'Table')} width={width} height={200}>
            {() => <MetaInfoText metaItems={[{ value: t('explore.table.no-data', '0 series returned') }]} />}
          </PanelChrome>
        )}
        {frames && frames.length > 0 && (
          <div className={css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) })}>
            {frames.map((data, i) => (
              <PanelChrome
                key={data.refId || `table-${i}`}
                title={this.getTableTitle(dataFrames, data, i)}
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
          </div>
        )}
      </>
    );
  }
}

export const TableContainerWithTheme = withTheme2(TableContainer);

export default withTheme2(connector(TableContainer));
