import React from 'react';

import { DataFrame } from '@grafana/data';
import { IconButton } from '@grafana/ui';

// const getStyles = (theme: GrafanaTheme2) => ({
//   logsStatsRow: css`
//     label: logs-stats-row;
//     margin: ${parseInt(theme.spacing(2), 10) / 1.75}px 0;
//   `,
//   logsStatsRowActive: css`
//     label: logs-stats-row--active;
//     color: ${theme.colors.primary.text};
//     position: relative;
//   `,
//   logsStatsRowLabel: css`
//     label: logs-stats-row__label;
//     display: flex;
//     margin-bottom: 1px;
//   `,
//   logsStatsRowValue: css`
//     label: logs-stats-row__value;
//     flex: 1;
//     text-overflow: ellipsis;
//     overflow: hidden;
//   `,
//   logsStatsRowCount: css`
//     label: logs-stats-row__count;
//     text-align: right;
//     margin-left: ${theme.spacing(0.75)};
//   `,
//   logsStatsRowPercent: css`
//     label: logs-stats-row__percent;
//     text-align: right;
//     margin-left: ${theme.spacing(0.75)};
//     width: ${theme.spacing(4.5)};
//   `,
//   logsStatsRowBar: css`
//     label: logs-stats-row__bar;
//     height: ${theme.spacing(0.5)};
//     overflow: hidden;
//     background: ${theme.colors.text.disabled};
//   `,
//   logsStatsRowInnerBar: css`
//     label: logs-stats-row__innerbar;
//     height: ${theme.spacing(0.5)};
//     overflow: hidden;
//     background: ${theme.colors.primary.main};
//   `,
// });

export interface Props {
  active?: boolean;
  count: number;
  proportion: number;
  value?: string;
  total: number;
  shouldFilter: boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  keyField: string;
}

export const LogLabelStatsRow = ({
  active,
  count,
  proportion,
  value,
  total,
  shouldFilter,
  onClickFilterLabel,
  onClickFilterOutLabel,
  keyField,
}: Props) => {
  // const style = useStyles2(getStyles);
  const percent = `${Math.round(proportion * 100)}%`;

  return (
    <tr>
      <td style={{ marginRight: '1.5em', width: '45px' }}>
        <IconButton
          disabled={!shouldFilter}
          size="xs"
          name="search-plus"
          aria-label="search-plus"
          onClick={() => onClickFilterLabel?.(keyField, value ?? '')}
        />
        <IconButton
          disabled={!shouldFilter}
          size="xs"
          name="search-minus"
          aria-label="search-minus"
          onClick={() => onClickFilterOutLabel?.(keyField, value ?? '')}
        />
      </td>
      <td
        style={{
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          marginRight: '1.5em',
        }}
      >
        {value}
      </td>
      <td style={{ width: '80px' }}>
        {count}/{total}
      </td>
      <td style={{ width: '40px' }}>{percent}</td>
    </tr>
  );
};

LogLabelStatsRow.displayName = 'LogLabelStatsRow';
