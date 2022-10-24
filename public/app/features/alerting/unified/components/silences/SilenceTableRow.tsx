import { css, cx } from '@emotion/css';
import React, { FC, Fragment, useState } from 'react';

import { dateMath, GrafanaTheme, intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles, Link } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { Silence, AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { expireSilenceAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { CollapseToggle } from '../CollapseToggle';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';

import { Matchers } from './Matchers';
import { SilenceStateTag } from './SilenceStateTag';
import SilencedAlertsTable from './SilencedAlertsTable';

interface Props {
  className?: string;
  silence: Silence;
  silencedAlerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

const SilenceTableRow: FC<Props> = ({ silence, className, silencedAlerts, alertManagerSourceName }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const dispatch = useDispatch();

  const styles = useStyles(getStyles);
  const { status, matchers = [], startsAt, endsAt, comment, createdBy } = silence;

  const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
  const startsAtDate = dateMath.parse(startsAt);
  const endsAtDate = dateMath.parse(endsAt);
  const duration = intervalToAbbreviatedDurationString({ start: new Date(startsAt), end: new Date(endsAt) });

  const handleExpireSilenceClick = () => {
    dispatch(expireSilenceAction(alertManagerSourceName, silence.id));
  };

  const detailsColspan = contextSrv.isEditor ? 4 : 3;

  return (
    <Fragment>
      <tr className={className} data-testid="silence-table-row">
        <td>
          <CollapseToggle isCollapsed={isCollapsed} onToggle={(value) => setIsCollapsed(value)} />
        </td>
        <td>
          <SilenceStateTag state={status.state} />
        </td>
        <td className={styles.matchersCell}>
          <Matchers matchers={matchers} />
        </td>
        <td data-testid="silenced-alerts">{silencedAlerts.length}</td>
        <td>
          {startsAtDate?.format(dateDisplayFormat)} {'-'}
          <br />
          {endsAtDate?.format(dateDisplayFormat)}
        </td>
        {contextSrv.isEditor && (
          <td className={styles.actionsCell}>
            {status.state === 'expired' ? (
              <Link href={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}>
                <ActionButton icon="sync">Recreate</ActionButton>
              </Link>
            ) : (
              <ActionButton icon="bell" onClick={handleExpireSilenceClick}>
                Unsilence
              </ActionButton>
            )}
            {status.state !== 'expired' && (
              <ActionIcon
                to={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}
                icon="pen"
                tooltip="edit"
              />
            )}
          </td>
        )}
      </tr>
      {!isCollapsed && (
        <>
          <tr className={className}>
            <td />
            <td>Comment</td>
            <td colSpan={detailsColspan}>{comment}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Schedule</td>
            <td colSpan={detailsColspan}>{`${startsAtDate?.format(dateDisplayFormat)} - ${endsAtDate?.format(
              dateDisplayFormat
            )}`}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Duration</td>
            <td colSpan={detailsColspan}>{duration}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Created by</td>
            <td colSpan={detailsColspan}>{createdBy}</td>
          </tr>
          {!!silencedAlerts.length && (
            <tr className={cx(className, styles.alertRulesCell)}>
              <td />
              <td>Affected alerts</td>
              <td colSpan={detailsColspan}>
                <SilencedAlertsTable silencedAlerts={silencedAlerts} />
              </td>
            </tr>
          )}
        </>
      )}
    </Fragment>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  matchersCell: css`
    & > * + * {
      margin-left: ${theme.spacing.xs};
    }
  `,
  actionsCell: css`
    text-align: right;
    width: 1%;
    white-space: nowrap;

    & > * + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
  alertRulesCell: css`
    vertical-align: top;
  `,
});

export default SilenceTableRow;
