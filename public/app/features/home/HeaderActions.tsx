import { t } from '@grafana/i18n';
import { Button, ButtonGroup, Stack, Text } from '@grafana/ui';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';

export function HeaderActions() {
  return (
    <ButtonGroup>
      <Button
        variant="secondary"
        tooltip={t('home.header-actions.firing-alerts', 'Firing alerts')}
        aria-label={t('home.header-actions.firing-alerts', 'Firing alerts')}
        icon="bell"
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Text>{58}</Text>

          <Stack direction="row" alignItems="center" gap={0.5}>
            <SeverityBars level="critical" />
            <Text>{11}</Text>
          </Stack>

          <Stack direction="row" alignItems="center" gap={0.5}>
            <SeverityBars level="major" />
            <Text>{47}</Text>
          </Stack>
        </Stack>
      </Button>

      <Button
        variant="secondary"
        tooltip={t('home.header-actions.active-incidents', 'Active incidents')}
        aria-label={t('home.header-actions.active-incidents', 'Active incidents')}
        icon="fire"
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Text>{50}+</Text>
        </Stack>
      </Button>
    </ButtonGroup>
  );
}
