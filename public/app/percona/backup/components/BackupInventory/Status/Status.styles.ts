import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { Status } from '../BackupInventory.types';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme, status: Status) => {
  const isSuccess = status === Status.SUCCESS;
  const isError = status === Status.ERROR || status === Status.STATUS_INVALID;

  if (isSuccess || isError) {
    return {
      status: css`
        color: ${isSuccess ? theme.palette.greenBase : theme.palette.redBase};
      `,
    };
  }

  return {};
});
