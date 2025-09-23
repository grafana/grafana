import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

import { BackupStatus, RestoreStatus } from '../../Backup.types';

import { successfulStates } from './Status.constants';

export const getStyles = stylesFactory(({ v1: { palette } }: GrafanaTheme2, status: BackupStatus | RestoreStatus) => ({
  statusContainer: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  ellipsisContainer: css`
    display: table;
    width: 15px;
  `,
  statusIcon: css`
    color: ${successfulStates.includes(status) ? palette.greenBase : palette.redBase};
  `,
  logs: css`
    color: ${palette.blue77};
    text-decoration: underline;
    cursor: pointer;
  `,
}));
