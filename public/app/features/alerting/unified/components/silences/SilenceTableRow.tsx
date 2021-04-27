import React, { FC, Fragment, useState } from 'react';
import { dateMath, GrafanaTheme, toDuration } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { Silence, AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AlertLabel } from '../AlertLabel';
import { StateTag } from '../StateTag';
import { CollapseToggle } from '../CollapseToggle';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { useStyles } from '@grafana/ui';
import SilencedAlertsTable from './SilencedAlertsTable';
import { expireSilenceAction } from '../../state/actions';
import { useDispatch } from 'react-redux';
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
  const { status, matchers, startsAt, endsAt, comment, createdBy } = silence;

  const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
  const startsAtDate = dateMath.parse(startsAt);
  const endsAtDate = dateMath.parse(endsAt);
  const duration = toDuration(endsAtDate?.diff(startsAtDate || '')).asSeconds();

  const handleExpireSilenceClick = () => {
    dispatch(expireSilenceAction(alertManagerSourceName, silence.id));
  };

  return (
    <Fragment>
      <tr className={className}>
        <td>
          <CollapseToggle isCollapsed={isCollapsed} onToggle={(value) => setIsCollapsed(value)} />
        </td>
        <td>
          <StateTag status={status.state}>{status.state}</StateTag>
        </td>
        <td className={styles.matchersCell}>
          {matchers?.map(({ name, value, isRegex }) => {
            return <AlertLabel key={`${name}-${value}`} labelKey={name} value={value} isRegex={isRegex} />;
          })}
        </td>
        <td>{silencedAlerts.length}</td>
        <td>
          {startsAtDate?.format(dateDisplayFormat)} {'-'}
          <br />
          {endsAtDate?.format(dateDisplayFormat)}
        </td>
        <td className={styles.actionsCell}>
          {status.state === 'expired' ? (
            <ActionButton icon="sync">Recreate</ActionButton>
          ) : (
            <ActionButton icon="bell" onClick={handleExpireSilenceClick}>
              Unsilence
            </ActionButton>
          )}
          <ActionIcon icon="pen" tooltip="edit" />
        </td>
      </tr>
      {!isCollapsed && (
        <>
          <tr className={className}>
            <td />
            <td>Comment</td>
            <td colSpan={4}>{comment}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Schedule</td>
            <td colSpan={4}>{`${startsAtDate?.format(dateDisplayFormat)} - ${endsAtDate?.format(
              dateDisplayFormat
            )}`}</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Duration</td>
            <td colSpan={4}>{duration} seconds</td>
          </tr>
          <tr className={className}>
            <td />
            <td>Created by</td>
            <td colSpan={4}>{createdBy}</td>
          </tr>
          {!!silencedAlerts.length && (
            <tr className={cx(className, styles.alertRulesCell)}>
              <td />
              <td>Affected alerts</td>
              <td colSpan={4}>
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
