import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { SilenceMetadataGrid } from './SilenceMetadataGrid';
import SilencedAlertsTable from './SilencedAlertsTable';
import { type SilenceTableItem } from './SilencesTable';

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
