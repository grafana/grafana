import { useCallback } from 'react';

import { CoreApp, LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';

import { getLogRowStyles } from '../getLogRowStyles';

import { LogDetailsStyles } from './LogDetails';

export interface Props {
  app?: CoreApp;
  disableActions: boolean;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  row: LogRowModel;
  styles: LogDetailsStyles;
}

export const LOG_LINE_BODY_FIELD_NAME = '___LOG_LINE_BODY___';

export const LogDetailsBody = ({
  app,
  displayedFields,
  disableActions,
  onClickHideField,
  onClickShowField,
  row,
  styles,
}: Props) => {
  const showField = useCallback(() => {
    if (onClickShowField) {
      onClickShowField(LOG_LINE_BODY_FIELD_NAME);
    }

    reportInteraction('grafana_explore_logs_log_details_show_body_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'enable',
      app,
    });
  }, [app, onClickShowField, row.datasourceType, row.uid]);

  const hideField = useCallback(() => {
    if (onClickHideField) {
      onClickHideField(LOG_LINE_BODY_FIELD_NAME);
    }

    reportInteraction('grafana_explore_logs_log_details_show_body_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'disable',
      app,
    });
  }, [app, onClickHideField, row.datasourceType, row.uid]);

  const rowStyles = useStyles2(getLogRowStyles);

  const toggleFieldButton =
    displayedFields != null && displayedFields.includes(LOG_LINE_BODY_FIELD_NAME) ? (
      <IconButton
        variant="primary"
        tooltip={t('logs.log-details-body.toggle-field-button.tooltip-hide-log-line', 'Hide log line')}
        name="eye"
        onClick={hideField}
      />
    ) : (
      <IconButton
        tooltip={t('logs.log-details-body.toggle-field-button.tooltip-show-log-line', 'Show log line')}
        name="eye"
        onClick={showField}
      />
    );

  return (
    <tr className={rowStyles.logDetailsValue}>
      <td className={rowStyles.logsDetailsIcon}>
        <div className={styles.bodyButtonRow}>{!disableActions && displayedFields && toggleFieldButton}</div>
      </td>

      <td className={rowStyles.logDetailsLabel} colSpan={100}>
        {row.entry}
      </td>
    </tr>
  );
};
