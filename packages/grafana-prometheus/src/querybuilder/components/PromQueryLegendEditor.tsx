// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryLegendEditor.tsx
import { useRef } from 'react';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { EditorField } from '@grafana/plugin-ui';
import { AutoSizeInput, Select } from '@grafana/ui';

import { LegendFormatMode } from '../../types';

interface PromQueryLegendEditorProps {
  legendFormat: string | undefined;
  onChange: (legendFormat: string) => void;
  onRunQuery: () => void;
}

const getLegendModeOptions = () => [
  {
    label: t('grafana-prometheus.prom-query-legend-editor.get-legend-mode-options.label-auto', 'Auto'),
    value: LegendFormatMode.Auto,
    description: t(
      'grafana-prometheus.prom-query-legend-editor.get-legend-mode-options.description-auto',
      'Only includes unique labels'
    ),
  },
  {
    label: t('grafana-prometheus.prom-query-legend-editor.get-legend-mode-options.label-verbose', 'Verbose'),
    value: LegendFormatMode.Verbose,
    description: t(
      'grafana-prometheus.prom-query-legend-editor.get-legend-mode-options.description-verbose',
      'All label names and values'
    ),
  },
  {
    label: t('grafana-prometheus.prom-query-legend-editor.get-legend-mode-options.label-custom', 'Custom'),
    value: LegendFormatMode.Custom,
    description: t(
      'grafana-prometheus.prom-query-legend-editor.get-legend-mode-options.description-custom',
      'Provide a naming template'
    ),
  },
];

/**
 * Tests for this component are on the parent level (PromQueryBuilderOptions).
 */
export const PromQueryLegendEditor = React.memo<PromQueryLegendEditorProps>(
  ({ legendFormat, onChange, onRunQuery }) => {
    const mode = getLegendMode(legendFormat);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const legendModeOptions = getLegendModeOptions();

    const onLegendFormatChanged = (evt: React.FormEvent<HTMLInputElement>) => {
      let newFormat = evt.currentTarget.value;
      if (newFormat.length === 0) {
        newFormat = LegendFormatMode.Auto;
      }

      if (newFormat !== legendFormat) {
        onChange(newFormat);
        onRunQuery();
      }
    };

    const onLegendModeChanged = (value: SelectableValue<LegendFormatMode>) => {
      switch (value.value!) {
        case LegendFormatMode.Auto:
          onChange(LegendFormatMode.Auto);
          break;
        case LegendFormatMode.Custom:
          onChange('{{label_name}}');
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(2, 12, 'forward');
          }, 10);
          break;
        case LegendFormatMode.Verbose:
          onChange('');
          break;
      }
      onRunQuery();
    };

    return (
      <EditorField
        label={t('grafana-prometheus.querybuilder.prom-query-legend-editor.label-legend', 'Legend')}
        tooltip={t(
          'grafana-prometheus.querybuilder.prom-query-legend-editor.tooltip-legend',
          'Series name override or template. Ex. {{templateExample}} will be replaced with label value for {{labelName}}.',
          { templateExample: '{{hostname}}', labelName: 'hostname' }
        )}
        data-testid={selectors.components.DataSource.Prometheus.queryEditor.legend}
      >
        <>
          {mode === LegendFormatMode.Custom && (
            <AutoSizeInput
              id="legendFormat"
              minWidth={22}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="auto"
              defaultValue={legendFormat}
              onCommitChange={onLegendFormatChanged}
              ref={inputRef}
            />
          )}
          {mode !== LegendFormatMode.Custom && (
            <Select
              inputId="legend.mode"
              isSearchable={false}
              placeholder={t(
                'grafana-prometheus.querybuilder.prom-query-legend-editor.placeholder-select-legend-mode',
                'Select legend mode'
              )}
              options={legendModeOptions}
              width={22}
              onChange={onLegendModeChanged}
              value={legendModeOptions.find((x) => x.value === mode)}
            />
          )}
        </>
      </EditorField>
    );
  }
);

PromQueryLegendEditor.displayName = 'PromQueryLegendEditor';

function getLegendMode(legendFormat: string | undefined) {
  // This special value means the new smart minimal series naming
  if (legendFormat === LegendFormatMode.Auto) {
    return LegendFormatMode.Auto;
  }

  // Missing or empty legend format is the old verbose behavior
  if (legendFormat == null || legendFormat === '') {
    return LegendFormatMode.Verbose;
  }

  return LegendFormatMode.Custom;
}

export function getLegendModeLabel(legendFormat: string | undefined) {
  const legendModeOptions = getLegendModeOptions();
  const mode = getLegendMode(legendFormat);
  if (mode !== LegendFormatMode.Custom) {
    return legendModeOptions.find((x) => x.value === mode)?.label;
  }
  return legendFormat;
}
