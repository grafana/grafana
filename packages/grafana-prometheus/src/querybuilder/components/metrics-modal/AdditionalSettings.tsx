// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/AdditionalSettings.tsx
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, Switch, Tooltip, useStyles2 } from '@grafana/ui';

import { useMetricsModal } from './MetricsModalContext';
import { getPlaceholders } from './helpers';
import { metricsModaltestIds } from './testIds';

export function AdditionalSettings() {
  const styles = useStyles2(getStyles);
  const placeholders = getPlaceholders();
  const { settings, overrideSettings } = useMetricsModal();

  return (
    <>
      <div className={styles.selectItem}>
        <Switch
          data-testid={metricsModaltestIds.searchWithMetadata}
          value={settings.fullMetaSearch}
          disabled={settings.useBackend || !settings.hasMetadata}
          onChange={() => overrideSettings({ fullMetaSearch: !settings.fullMetaSearch })}
        />
        <div className={styles.selectItemLabel}>{placeholders.metadataSearchSwitch}</div>
      </div>
      <div className={styles.selectItem}>
        <Switch
          value={settings.includeNullMetadata}
          disabled={!settings.hasMetadata}
          onChange={() => overrideSettings({ includeNullMetadata: !settings.includeNullMetadata })}
        />
        <div className={styles.selectItemLabel}>{placeholders.includeNullMetadata}</div>
      </div>
      <div className={styles.selectItem}>
        <Switch
          value={settings.disableTextWrap}
          onChange={() => overrideSettings({ disableTextWrap: !settings.disableTextWrap })}
        />
        <div className={styles.selectItemLabel}>
          <Trans i18nKey="grafana-prometheus.querybuilder.additional-settings.disable-text-wrap">
            Disable text wrap
          </Trans>
        </div>
      </div>
      <div className={styles.selectItem}>
        <Switch
          data-testid={metricsModaltestIds.setUseBackend}
          value={settings.useBackend}
          onChange={() => overrideSettings({ useBackend: !settings.useBackend })}
        />
        <div className={styles.selectItemLabel}>{placeholders.setUseBackend}&nbsp;</div>
        <Tooltip
          content={t(
            'grafana-prometheus.querybuilder.additional-settings.content-filter-metric-names-regex-search-using',
            'Filter metric names by regex search, using an additional call on the Prometheus API.'
          )}
          placement="bottom-end"
        >
          <Icon name="info-circle" size="xs" className={styles.settingsIcon} />
        </Tooltip>
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    settingsIcon: css({
      color: theme.colors.text.secondary,
    }),
    selectItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '4px 0',
    }),
    selectItemLabel: css({
      margin: `0 0 0 ${theme.spacing(1)}`,
      alignSelf: 'center',
      color: theme.colors.text.secondary,
      fontSize: '12px',
    }),
  };
}
