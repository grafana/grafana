import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import {
  LogLabelStatsModel,
  GrafanaTheme2,
  createDataFrame,
  FieldType,
  LoadingState,
  getDefaultTimeRange,
  DataFrame,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { stylesFactory, withTheme2, Themeable2 } from '@grafana/ui';

//Components
import { LogLabelStatsRow } from './LogLabelStatsRow';

const STATS_ROW_LIMIT = 5;

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    logsStats: css`
      label: logs-stats;
      background: inherit;
      color: ${theme.colors.text.primary};
      word-break: break-all;
      margin: ${theme.spacing(0.5)} 0;
      padding: 0 ${theme.spacing(1)};
    `,
    logsStatsHeader: css`
      label: logs-stats__header;
      border-bottom: 1px solid ${theme.colors.border.medium};
      display: flex;
    `,
    logsStatsTitle: css`
      label: logs-stats__title;
      font-weight: ${theme.typography.fontWeightMedium};
      padding-right: ${theme.spacing(2)};
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
      padding-top: ${theme.spacing(0.5)};
    `,
    logsStatsClose: css`
      label: logs-stats__close;
      cursor: pointer;
    `,
    logsStatsBody: css`
      label: logs-stats__body;
      padding: 0;
      display: flex;
    `,
  };
});

interface Props extends Themeable2 {
  stats: LogLabelStatsModel[];
  label: string;
  value: string;
  rowCount: number;
  isLabel?: boolean;
  shouldFilter: boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
}

class UnThemedLogLabelStats extends PureComponent<Props> {
  render() {
    const { label, stats, theme, shouldFilter, onClickFilterLabel, onClickFilterOutLabel } = this.props;
    const style = getStyles(theme);
    const topRows = stats.slice(0, STATS_ROW_LIMIT);
    let otherRows = stats.slice(STATS_ROW_LIMIT);
    const otherCount = otherRows.reduce((sum, row) => sum + row.count, 0);
    const topCount = topRows.reduce((sum, row) => sum + row.count, 0);
    const total = topCount + otherCount;
    const otherProportion = otherCount / total;

    const frame = createDataFrame({
      fields: stats.map((stat) => {
        return { name: `{${label}="${stat.value}"}`, type: FieldType.number, values: [stat.count] };
      }),
    });

    if (otherProportion >= 0.97) {
      // guard check for when there are too many unique values
      return <></>;
    }
    return (
      <div className={style.logsStats} data-testid="logLabelStats">
        <div className={style.logsStatsBody}>
          <table style={{ width: '85%' }}>
            <tbody>
              <tr>
                <td colSpan={4}>
                  <div className={style.logsStatsTitle}>{label}</div>
                </td>
              </tr>
              {topRows.map((stat) => (
                <LogLabelStatsRow
                  key={stat.value}
                  {...stat}
                  active={false}
                  total={total}
                  shouldFilter={shouldFilter}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  keyField={label}
                />
              ))}
              {otherCount > 0 && (
                <LogLabelStatsRow
                  key="__OTHERS__"
                  count={otherCount}
                  value="Other"
                  proportion={otherProportion}
                  total={total}
                  shouldFilter={false}
                  keyField={label}
                  onClickFilterLabel={onClickFilterLabel}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                />
              )}
            </tbody>
          </table>
          <div style={{ width: '15%', minWidth: 65, display: 'flex', justifyContent: 'center', alignItems: 'cent' }}>
            {stats.length > 1 && (
              <PanelRenderer
                pluginId="piechart"
                height={95}
                width={95}
                title="Pie Chart"
                data={{
                  series: [frame],
                  timeRange: getDefaultTimeRange(),
                  state: LoadingState.Done,
                }}
                options={{
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '',
                  },
                  pieType: 'pie',
                  tooltip: {
                    mode: 'single',
                    sort: 'none',
                  },
                  legend: {
                    showLegend: false,
                    displayMode: 'table',
                    placement: 'right',
                    values: ['percent'],
                  },
                  displayLabels: ['percent'],
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}

export const LogLabelStats = withTheme2(UnThemedLogLabelStats);
LogLabelStats.displayName = 'LogLabelStats';
