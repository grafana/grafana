import { useLocalStorage } from 'react-use';

import { Alert, LinkButton, Stack } from '@grafana/ui';

import { t, Trans } from '../../core/internationalization';

type Props = {
  datasourceType: string;
};

export function DrilldownAlertBox(props: Props) {
  const isDsCompatibleWithDrilldown = [
    'prometheus',
    'grafana-amazonprometheus-datasource',
    'grafana-azureprometheus-datasource',
    'loki',
    'tempo',
    'grafana-pyroscope-datasource',
  ].includes(props.datasourceType);

  const [dismissed, setDismissed] = useLocalStorage('grafana.explore.drilldownsBoxDismissed', false);

  return (
    isDsCompatibleWithDrilldown &&
    !dismissed && (
      <Alert
        severity={'info'}
        title={t('explore.drilldownInfo.title', 'Explore Metrics, Logs, Traces and Profiles have moved!')}
        onRemove={() => {
          setDismissed(true);
        }}
      >
        <Stack gap={1} alignItems="flex-end" justifyContent={'space-between'}>
          <span>
            <Trans i18nKey={'explore.drilldownInfo.description'}>
              Looking for the Grafana Explore apps? They are now called the Grafana Drilldown apps and can be found
              under <b>Menu &gt; Drilldown</b>
            </Trans>
          </span>
          <LinkButton variant={'secondary'} href="/drilldown">
            <Trans i18nKey={'explore.drilldownInfo.action'}>Go to Grafana Drilldown</Trans>
          </LinkButton>
        </Stack>
      </Alert>
    )
  );
}
