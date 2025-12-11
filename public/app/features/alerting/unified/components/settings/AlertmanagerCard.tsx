import { capitalize } from 'lodash';

import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Card, Stack, Text, TextLink } from '@grafana/ui';
import alertmanagerLogo from 'app/plugins/datasource/alertmanager/img/logo.svg';

import { ConnectionStatus } from '../../hooks/useExternalAmSelector';
import { ProvisioningBadge } from '../Provisioning';
import { WithReturnButton } from '../WithReturnButton';

interface Props {
  name: string;
  href?: string;
  url?: string;
  logo?: string;
  provisioned?: boolean;
  readOnly?: boolean;
  showStatus?: boolean;
  implementation?: string;
  receiving?: boolean;
  status?: ConnectionStatus;
  // functions
  onEditConfiguration: () => void;
  onDisable?: () => void;
  onEnable?: () => void;
}

export function AlertmanagerCard({
  name,
  href,
  url,
  logo = alertmanagerLogo,
  provisioned = false,
  readOnly = provisioned,
  showStatus = true,
  implementation,
  receiving = false,
  status = 'unknown',
  onEditConfiguration,
  onEnable,
  onDisable,
}: Props) {
  const showActions = !provisioned && Boolean(onEnable) && Boolean(onDisable);

  return (
    <Card noMargin data-testid={`alertmanager-card-${name}`}>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          {href ? (
            <WithReturnButton
              title={t('alerting.alertmanager-card.title-alerting-settings', 'Alerting settings')}
              component={
                <TextLink href={href} inline={false}>
                  {name}
                </TextLink>
              }
            />
          ) : (
            name
          )}
          {provisioned && <ProvisioningBadge />}
        </Stack>
      </Card.Heading>
      <Card.Figure>
        <img alt={`logo for ${name}`} src={logo} />
      </Card.Figure>

      {/* sadly we have to resort to "mimicking" the Card.Description in here because "<div>"s can not be child elements of "<p>" – which is what the description element wrapper is */}
      <Card.Meta>
        <Stack direction="column" gap={1} alignItems="flex-start">
          <Card.Meta>
            {implementation && capitalize(implementation)}
            {url && url}
          </Card.Meta>
          {/* if forwarding is diabled, still show status for the "canonical" Alertmanager */}
          {showStatus ? (
            <>
              {!receiving ? (
                <Text variant="bodySmall">
                  <Trans i18nKey="alerting.alertmanager-card.not-receiving-grafana-managed-alerts">
                    Not receiving Grafana managed alerts
                  </Trans>
                </Text>
              ) : (
                <>
                  {status === 'pending' && (
                    <Badge
                      text={t('alerting.alertmanager-card.text-activation-in-progress', 'Activation in progress')}
                      color="orange"
                    />
                  )}
                  {status === 'active' && (
                    <Badge
                      text={t(
                        'alerting.alertmanager-card.text-receiving-grafanamanaged-alerts',
                        'Receiving Grafana-managed alerts'
                      )}
                      color="green"
                    />
                  )}
                  {status === 'dropped' && (
                    <Badge
                      text={t(
                        'alerting.alertmanager-card.text-failed-to-adopt-alertmanager',
                        'Failed to adopt Alertmanager'
                      )}
                      color="red"
                    />
                  )}
                  {status === 'inconclusive' && (
                    <Badge text={t('alerting.alertmanager-card.text-inconclusive', 'Inconclusive')} color="orange" />
                  )}
                </>
              )}
            </>
          ) : null}
        </Stack>
      </Card.Meta>

      {/* we'll use the "tags" area to append buttons and actions */}
      <Card.Tags>
        <Stack direction="row" gap={1}>
          {/* ⚠️ provisioned Data sources cannot have their "enable" / "disable" actions but we should still allow editing of the configuration */}
          <Button onClick={onEditConfiguration} icon={readOnly ? 'eye' : 'edit'} variant="secondary" fill="outline">
            {readOnly ? (
              <Trans i18nKey="alerting.alertmanager-card.view-configuration">View configuration</Trans>
            ) : (
              <Trans i18nKey="alerting.alertmanager-card.edit-configuration">Edit configuration</Trans>
            )}
          </Button>
          {showActions ? (
            <>
              {receiving ? (
                <Button icon="times" variant="destructive" fill="outline" onClick={onDisable}>
                  <Trans i18nKey="alerting.alertmanager-card.disable">Disable</Trans>
                </Button>
              ) : (
                <Button icon="check" variant="secondary" fill="outline" onClick={onEnable}>
                  <Trans i18nKey="alerting.alertmanager-card.enable">Enable</Trans>
                </Button>
              )}
            </>
          ) : null}
        </Stack>
      </Card.Tags>
    </Card>
  );
}
