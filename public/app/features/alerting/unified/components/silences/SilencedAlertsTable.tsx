import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { getAlertTableStyles } from '../../styles/table';

import { SilencedAlertsTableRow } from './SilencedAlertsTableRow';

interface Props {
  silencedAlerts: AlertmanagerAlert[];
}

const SilencedAlertsTable = ({ silencedAlerts }: Props) => {
  const tableStyles = useStyles2(getAlertTableStyles);
  const styles = useStyles2(getStyles);

  if (!!silencedAlerts.length) {
    return (
      <table className={cx(tableStyles.table, styles.tableMargin)}>
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col className={styles.colState} />
          <col />
          <col className={styles.colName} />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th>
              <Trans i18nKey="silences-table.header.state">State</Trans>
            </th>
            <th />
            <th>
              <Trans i18nKey="silences-table.header.alert-name">Alert name</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {silencedAlerts.map((alert, index) => {
            return (
              <SilencedAlertsTableRow
                key={alert.fingerprint}
                alert={alert}
                className={index % 2 === 0 ? tableStyles.evenRow : ''}
              />
            );
          })}
        </tbody>
      </table>
    );
  } else {
    return null;
  }
};

const getStyles = (theme: GrafanaTheme2) => ({
  tableMargin: css({
    marginBottom: theme.spacing(1),
  }),
  colState: css({
    width: '110px',
  }),
  colName: css({
    width: '65%',
  }),
});

export default SilencedAlertsTable;
