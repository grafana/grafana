import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';

import { CoreApp, GrafanaTheme2, LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, Themeable2 } from '@grafana/ui';

import { getLogRowStyles } from './getLogRowStyles';

export interface Props extends Themeable2 {
  app?: CoreApp;
  disableActions: boolean;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  row: LogRowModel;
  theme: GrafanaTheme2;
}

const getStyles = memoizeOne((theme: GrafanaTheme2) => {
  return {
    buttonRow: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      marginLeft: theme.spacing(0.5),
    }),
  };
});

export const LOG_LINE_BODY_FIELD_NAME = '___LOG_LINE_BODY___';

export const LogDetailsBody = (props: Props) => {
  const showField = () => {
    const { onClickShowField, row } = props;
    if (onClickShowField) {
      onClickShowField(LOG_LINE_BODY_FIELD_NAME);
    }

    reportInteraction('grafana_explore_logs_log_details_show_body_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'enable',
      app: props.app,
    });
  };

  const hideField = () => {
    const { onClickHideField, row } = props;
    if (onClickHideField) {
      onClickHideField(LOG_LINE_BODY_FIELD_NAME);
    }

    reportInteraction('grafana_explore_logs_log_details_show_body_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'disable',
      app: props.app,
    });
  };

  const { theme, displayedFields, disableActions, row } = props;
  const styles = getStyles(theme);
  const rowStyles = getLogRowStyles(theme);

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
        <div className={styles.buttonRow}>{!disableActions && displayedFields && toggleFieldButton}</div>
      </td>

      <td className={rowStyles.logDetailsLabel} colSpan={100}>
        {row.entry}
      </td>
    </tr>
  );
};
