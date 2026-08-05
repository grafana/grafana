import { css } from '@emotion/css';
import { type RefObject } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, ButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';

import { ALERTS_TAB_ID, INCIDENTS_TAB_ID, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';

export function HeaderActions({ alertIncidentRef }: { alertIncidentRef: RefObject<AlertIncidentSwitchHandle> }) {
  const styles = useStyles2(getStyles);

  return (
    <ButtonGroup className={styles.group}>
      <Button
        variant="secondary"
        tooltip={t('home.header-actions.firing-alerts', 'Firing alerts')}
        aria-label={t('home.header-actions.firing-alerts', 'Firing alerts')}
        icon="bell"
        onClick={() => alertIncidentRef.current?.switch(ALERTS_TAB_ID)}
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
        onClick={() => alertIncidentRef.current?.switch(INCIDENTS_TAB_ID)}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Text>{50}+</Text>
        </Stack>
      </Button>
    </ButtonGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  group: css({
    marginTop: 'auto',
  }),
});
