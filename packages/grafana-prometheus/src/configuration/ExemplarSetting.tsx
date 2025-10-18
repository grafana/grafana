// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/ExemplarSetting.tsx
import { useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, Input, Switch, useTheme2 } from '@grafana/ui';

import { PROM_CONFIG_LABEL_WIDTH } from '../constants';
import { ExemplarTraceIdDestination } from '../types';

import { docsTip, overhaulStyles } from './shared/utils';

type Props = {
  value: ExemplarTraceIdDestination;
  onChange: (value: ExemplarTraceIdDestination) => void;
  onDelete: () => void;
  disabled?: boolean;
};

export function ExemplarSetting({ value, onChange, onDelete, disabled }: Props) {
  const [isInternalLink, setIsInternalLink] = useState(Boolean(value.datasourceUid));

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  return (
    <div className="gf-form-group">
      <InlineField
        label={t('grafana-prometheus.configuration.exemplar-setting.label-internal-link', 'Internal link')}
        labelWidth={PROM_CONFIG_LABEL_WIDTH}
        disabled={disabled}
        tooltip={
          <>
            <Trans i18nKey="grafana-prometheus.configuration.exemplar-setting.tooltip-internal-link">
              Enable this option if you have an internal link. When enabled, this reveals the data source selector.
              Select the backend tracing data store for your exemplar data.
            </Trans>{' '}
            {docsTip()}
          </>
        }
        interactive={true}
        className={styles.switchField}
      >
        <>
          <Switch
            value={isInternalLink}
            data-testid={selectors.components.DataSource.Prometheus.configPage.internalLinkSwitch}
            onChange={(ev) => setIsInternalLink(ev.currentTarget.checked)}
          />
        </>
      </InlineField>

      {isInternalLink ? (
        <InlineField
          label={t('grafana-prometheus.configuration.exemplar-setting.label-data-source', 'Data source')}
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          tooltip={
            <>
              <Trans i18nKey="grafana-prometheus.configuration.exemplar-setting.tooltip-data-source">
                The data source the exemplar is going to navigate to.
              </Trans>{' '}
              {docsTip()}
            </>
          }
          disabled={disabled}
          interactive={true}
        >
          <DataSourcePicker
            filter={
              config.featureToggles.azureMonitorPrometheusExemplars
                ? undefined
                : (ds) => ds.type !== 'grafana-azure-monitor-datasource'
            }
            tracing={true}
            current={value.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds: DataSourceInstanceSettings) =>
              onChange({
                ...value,
                datasourceUid: ds.uid,
                url: undefined,
              })
            }
          />
        </InlineField>
      ) : (
        <InlineField
          label={t('grafana-prometheus.configuration.exemplar-setting.label-url', 'URL')}
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          tooltip={
            <>
              <Trans i18nKey="grafana-prometheus.configuration.exemplar-setting.tooltip-url">
                The URL of the trace backend the user would go to see its trace
              </Trans>{' '}
              {docsTip()}
            </>
          }
          disabled={disabled}
          interactive={true}
        >
          <Input
            placeholder={t(
              'grafana-prometheus.configuration.exemplar-setting.placeholder-httpsexamplecomvalueraw',
              'https://example.com/${__value.raw}'
            )}
            spellCheck={false}
            width={40}
            value={value.url}
            onChange={(event) =>
              onChange({
                ...value,
                datasourceUid: undefined,
                url: event.currentTarget.value,
              })
            }
          />
        </InlineField>
      )}

      <InlineField
        label={t('grafana-prometheus.configuration.exemplar-setting.label-url-label', 'URL Label')}
        labelWidth={PROM_CONFIG_LABEL_WIDTH}
        tooltip={
          <>
            <Trans i18nKey="grafana-prometheus.configuration.exemplar-setting.tooltip-url-label">
              Use to override the button label on the exemplar traceID field.
            </Trans>{' '}
            {docsTip()}
          </>
        }
        disabled={disabled}
        interactive={true}
      >
        <Input
          placeholder={t(
            'grafana-prometheus.configuration.exemplar-setting.placeholder-go-to-examplecom',
            'Go to example.com'
          )}
          spellCheck={false}
          width={40}
          value={value.urlDisplayLabel}
          onChange={(event) =>
            onChange({
              ...value,
              urlDisplayLabel: event.currentTarget.value,
            })
          }
        />
      </InlineField>
      <InlineField
        label={t('grafana-prometheus.configuration.exemplar-setting.label-label-name', 'Label name')}
        labelWidth={PROM_CONFIG_LABEL_WIDTH}
        tooltip={
          <>
            <Trans i18nKey="grafana-prometheus.configuration.exemplar-setting.tooltip-label-name">
              The name of the field in the labels object that should be used to get the traceID.
            </Trans>{' '}
            {docsTip()}
          </>
        }
        disabled={disabled}
        interactive={true}
      >
        <Input
          placeholder={t('grafana-prometheus.configuration.exemplar-setting.placeholder-trace-id', 'traceID')}
          spellCheck={false}
          width={40}
          value={value.name}
          onChange={(event) =>
            onChange({
              ...value,
              name: event.currentTarget.value,
            })
          }
        />
      </InlineField>
      {!disabled && (
        <InlineField
          label={t(
            'grafana-prometheus.configuration.exemplar-setting.label-remove-exemplar-link',
            'Remove exemplar link'
          )}
          labelWidth={PROM_CONFIG_LABEL_WIDTH}
          disabled={disabled}
        >
          <Button
            variant="destructive"
            aria-label={t(
              'grafana-prometheus.configuration.exemplar-setting.title-remove-exemplar-link',
              'Remove exemplar link'
            )}
            icon="times"
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
          />
        </InlineField>
      )}
    </div>
  );
}
