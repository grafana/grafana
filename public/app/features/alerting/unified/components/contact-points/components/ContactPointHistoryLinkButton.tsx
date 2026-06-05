import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

export interface ContactPointHistoryLinkButtonProps {
  contactPointName: string;
  integrationsCount: number;
}

export function ContactPointHistoryLinkButton({
  contactPointName,
  integrationsCount,
}: ContactPointHistoryLinkButtonProps) {
  if (!config.featureToggles.alertingNotificationHistoryGlobal) {
    return null;
  }

  return (
    <LinkButton
      variant="secondary"
      size="sm"
      icon="history"
      type="button"
      disabled={integrationsCount === 0}
      tooltip={t(
        'alerting.contact-point-header.tooltip-history',
        'View the history of notification attempts made to this contact point'
      )}
      tooltipPlacement="top"
      data-testid="history-action"
      href={createRelativeUrl('/alerting/history', {
        tab: 'notifications',
        'var-RECEIVER_FILTER': contactPointName,
      })}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t('alerting.contact-point-header.button-history', 'History')}
    </LinkButton>
  );
}
