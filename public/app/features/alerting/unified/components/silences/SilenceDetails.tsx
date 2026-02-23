import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, useStyles2 } from '@grafana/ui';

import { SilenceMetadataGrid } from './SilenceMetadataGrid';
import SilencedAlertsTable from './SilencedAlertsTable';
import { SilenceTableItem } from './SilencesTable';

interface Props {
  silence: SilenceTableItem;
}

export const SilenceDetails = ({ silence }: Props) => {
  const { startsAt, endsAt, comment, createdBy, silencedAlerts } = silence;
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      <SilenceMetadataGrid {...{ startsAt, endsAt, comment, createdBy }} />
      {Array.isArray(silencedAlerts) && (
        <>
          <div className={styles.title}>
            <Trans i18nKey="alerting.silence-details.affected-alerts">Affected alerts</Trans>
          </div>
          <SilencedAlertsTable silencedAlerts={silencedAlerts} />
        </>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  title: css({
    color: theme.colors.text.primary,
  }),
});
