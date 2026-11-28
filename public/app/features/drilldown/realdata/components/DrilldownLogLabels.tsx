import { css } from '@emotion/css';

import { type GrafanaTheme2, formattedValueToString, getValueFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { TOP_LOG_LABELS } from '../liveScenario';

export function DrilldownLogLabels() {
  const styles = useStyles2(getStyles);

  if (TOP_LOG_LABELS.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="drilldown-log-labels-title">
      <Stack direction="column" gap={1.5}>
        <div>
          <Text element="h2" variant="h3" id="drilldown-log-labels-title">
            {t('drilldown-real.log-labels.title', 'Top log labels')}
          </Text>
          <Text color="secondary" variant="bodySmall">
            {t(
              'drilldown-real.log-labels.description',
              'By estimated log volume in the last 30 minutes. A log can contribute to more than one label.'
            )}
          </Text>
        </div>
        <ol className={styles.list}>
          {TOP_LOG_LABELS.map(({ label, bytes }) => (
            <li key={label} className={styles.label}>
              <Text weight="medium">{label}</Text>
              <Text color="secondary">{formattedValueToString(getValueFormat('decbytes')(bytes))}</Text>
            </li>
          ))}
        </ol>
      </Stack>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: theme.spacing(1, 3),
    listStyle: 'none',
    padding: 0,
    margin: 0,
  }),
  label: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing(2),
    minWidth: 0,
    overflowWrap: 'anywhere',
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});
