import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useSilenceAbility } from '../../hooks/abilities/useSilenceAbility';;

import { useGlobalRuleAbility } from '../../hooks/abilities/ruleAbilities';
import { SilenceAction, RuleAction } from '../../hooks/abilities/types';
import { isGrafanaRulesSource } from '../../utils/datasource';
import { makeAMLink, makeLabelBasedSilenceLink } from '../../utils/misc';
import { AnnotationDetailsField } from '../AnnotationDetailsField';

interface AmNotificationsAlertDetailsProps {
  alertManagerSourceName: string;
  alert: AlertmanagerAlert;
}

export const AlertDetails = ({ alert, alertManagerSourceName }: AmNotificationsAlertDetailsProps) => {
  const styles = useStyles2(getStyles);

  // For Grafana Managed alerts the Generator URL redirects to the alert rule edit page, so update permission is required
  // For external alert manager the Generator URL redirects to an external service which we don't control
  const isGrafanaSource = isGrafanaRulesSource(alertManagerSourceName);
  const viewRuleAbility = useGlobalRuleAbility(RuleAction.View);
  const isSeeSourceButtonEnabled = isGrafanaSource ? isGranted(viewRuleAbility) : true;
  const canCreateSilence = isGranted(useSilenceAbility({ action: SilenceAction.Create }));
  const canUpdateSilence = isGranted(useSilenceAbility({ action: SilenceAction.Update }));

  return (
    <>
      <div className={styles.actionsRow}>
        {alert.status.state === AlertState.Suppressed && (canCreateSilence || canUpdateSilence) && (
          <LinkButton
            href={`${makeAMLink(
              '/alerting/silences',
              alertManagerSourceName
            )}&silenceIds=${alert.status.silencedBy.join(',')}`}
            className={styles.button}
            icon={'bell'}
            size={'sm'}
          >
            <Trans i18nKey="alerting.alert-details.manage-silences">Manage silences</Trans>
          </LinkButton>
        )}
        {alert.status.state === AlertState.Active && canCreateSilence && (
          <LinkButton
            href={makeLabelBasedSilenceLink(alertManagerSourceName, alert.labels)}
            className={styles.button}
            icon={'bell-slash'}
            size={'sm'}
          >
            <Trans i18nKey="alerting.alert-details.silence">Silence</Trans>
          </LinkButton>
        )}
        {isSeeSourceButtonEnabled && alert.generatorURL && (
          <LinkButton className={styles.button} href={alert.generatorURL} icon={'chart-line'} size={'sm'}>
            {isGrafanaSource
              ? t('alerting.alert-details.button-see-rule', 'See alert rule')
              : t('alerting.alert-details.button-see-source', 'See source')}
          </LinkButton>
        )}
      </div>
      {Object.entries(alert.annotations).map(([annotationKey, annotationValue]) => (
        <AnnotationDetailsField key={annotationKey} annotationKey={annotationKey} value={annotationValue} />
      ))}
      <div className={styles.receivers}>
        <Trans
          i18nKey="alerting.alert-details.receivers-list"
          values={{
            receivers: alert.receivers
              .map(({ name }) => name)
              .filter((name) => !!name)
              .join(', '),
          }}
        >
          Receivers: {'{{receivers}}'}
        </Trans>
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
