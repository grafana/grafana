// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/AdditionalSettings.tsx
import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Switch, Tooltip, useStyles2 } from '@grafana/ui';

import { useMetricsModal } from './MetricsModalContext';
import { getPlaceholders } from './helpers';
import { metricsModaltestIds } from './testIds';

interface SwitchItemProps {
  testId?: string;
  value: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string | React.ReactElement;
  tooltip?: {
    content: string;
    placement?: 'bottom-end' | 'bottom' | 'top' | 'left' | 'right';
  };
}

function SwitchItem({ testId, value, disabled = false, onChange, label, tooltip }: SwitchItemProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.selectItem}>
      <Switch data-testid={testId} value={value} disabled={disabled} onChange={onChange} />
      <div className={styles.selectItemLabel}>{label}</div>
      {tooltip && (
        <Tooltip content={tooltip.content} placement={tooltip.placement || 'bottom-end'}>
          <Icon name="info-circle" size="xs" className={styles.settingsIcon} />
        </Tooltip>
      )}
    </div>
  );
}

export function AdditionalSettings() {
  const { settings, updateSettings } = useMetricsModal();

  const placeholders = useMemo(() => getPlaceholders(), []);

  const toggleSetting = useCallback(
    <K extends keyof typeof settings>(key: K) => {
      updateSettings({ [key]: !settings[key] });
    },
    [settings, updateSettings]
  );

  const backendTooltipContent = useMemo(
    () =>
      t(
        'grafana-prometheus.querybuilder.additional-settings.content-filter-metric-names-regex-search-using',
        'Filter metric names by regex search, using an additional call on the Prometheus API.'
      ),
    []
  );

  const isMetadataSearchDisabled = useMemo(
    () => settings.useBackend || !settings.hasMetadata,
    [settings.useBackend, settings.hasMetadata]
  );

  const isNullMetadataDisabled = useMemo(() => !settings.hasMetadata, [settings.hasMetadata]);

  return (
    <div role="group">
      <SwitchItem
        testId={metricsModaltestIds.searchWithMetadata}
        value={settings.fullMetaSearch}
        disabled={isMetadataSearchDisabled}
        onChange={() => toggleSetting('fullMetaSearch')}
        label={placeholders.metadataSearchSwitch}
      />
      <SwitchItem
        value={settings.includeNullMetadata}
        disabled={isNullMetadataDisabled}
        onChange={() => toggleSetting('includeNullMetadata')}
        label={placeholders.includeNullMetadata}
      />
      <SwitchItem
        value={settings.disableTextWrap}
        onChange={() => toggleSetting('disableTextWrap')}
        label={placeholders.disableTextWrap}
      />
      <SwitchItem
        testId={metricsModaltestIds.setUseBackend}
        value={settings.useBackend}
        onChange={() => toggleSetting('useBackend')}
        label={placeholders.setUseBackend}
        tooltip={{
          content: backendTooltipContent,
          placement: 'bottom-end',
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    settingsIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(0.5),
      cursor: 'help',
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    selectItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing(0.5, 0),
      gap: theme.spacing(1),
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.shape.radius.default,
        padding: theme.spacing(0.5, 1),
        margin: theme.spacing(0, -1),
      },
    }),
    selectItemLabel: css({
      alignSelf: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightRegular,
      userSelect: 'none',
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
