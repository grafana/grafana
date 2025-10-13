import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState, AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { AlertmanagerAction } from '../../hooks/useAbilities';
import { isGrafanaRulesSource } from '../../utils/datasource';
import { makeAMLink, makeLabelBasedSilenceLink } from '../../utils/misc';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { Authorize } from '../Authorize';

interface AmNotificationsAlertDetailsProps {
  alertManagerSourceName: string;
  alert: AlertmanagerAlert;
}

export const AlertDetails = ({ alert, alertManagerSourceName }: AmNotificationsAlertDetailsProps) => {
  const styles = useStyles2(getStyles);

  // For Grafana Managed alerts the Generator URL redirects to the alert rule edit page, so update permission is required
  // For external alert manager the Generator URL redirects to an external service which we don't control
  const isGrafanaSource = isGrafanaRulesSource(alertManagerSourceName);
  const isSeeSourceButtonEnabled = isGrafanaSource
    ? contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)
    : true;

  return (
    <>
      <div className={styles.actionsRow}>
        {alert.status.state === AlertState.Suppressed && (
          <Authorize actions={[AlertmanagerAction.CreateSilence, AlertmanagerAction.UpdateSilence]}>
            <LinkButton
              href={`${makeAMLink(
                '/alerting/silences',
                alertManagerSourceName
              )}&silenceIds=${alert.status.silencedBy.join(',')}`}
              className={styles.button}
              icon={'bell'}
              size={'sm'}
            >
              Manage silences
            </LinkButton>
          </Authorize>
        )}
        {alert.status.state === AlertState.Active && (
          <Authorize actions={[AlertmanagerAction.CreateSilence]}>
            <LinkButton
              href={makeLabelBasedSilenceLink(alertManagerSourceName, alert.labels)}
              className={styles.button}
              icon={'bell-slash'}
              size={'sm'}
            >
              Silence
            </LinkButton>
          </Authorize>
        )}
        {isSeeSourceButtonEnabled && alert.generatorURL && (
          <LinkButton className={styles.button} href={alert.generatorURL} icon={'chart-line'} size={'sm'}>
            {isGrafanaSource ? 'See alert rule' : 'See source'}
          </LinkButton>
        )}
      </div>
      {Object.entries(alert.annotations).map(([annotationKey, annotationValue]) => (
        <AnnotationDetailsField key={annotationKey} annotationKey={annotationKey} value={annotationValue} />
      ))}
      <div className={styles.receivers}>
        Receivers:{' '}
        {alert.receivers
          .map(({ name }) => name)
          .filter((name) => !!name)
          .join(', ')}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    '& + &': {
      marginLeft: theme.spacing(1),
    },
  }),
  actionsRow: css({
    padding: `${theme.spacing(2, 0)} !important`,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
  receivers: css({
    padding: theme.spacing(1, 0),
  }),
});
