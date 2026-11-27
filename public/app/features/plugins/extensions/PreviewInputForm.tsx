import { type Draft07 } from 'json-schema-library';
import { useId, useState } from 'react';

import { type ComponentDescriptor, type DataSourceRef, getDefaultTimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Field, Stack, TextArea, TimeRangeInput } from '@grafana/ui';
import { isRecord } from 'app/core/utils/isRecord';

import { type PreviewInputs } from './CatalogPreview';

interface Props {
  entry: ComponentDescriptor;
  selection: PreviewInputs;
  schema?: Draft07;
  onApply: (inputs: PreviewInputs) => void;
}

export function PreviewInputForm({ entry, selection, schema, onApply }: Props) {
  const inputId = useId();
  const [ref, setRef] = useState<DataSourceRef>();
  const [range, setRange] = useState(() => getDefaultTimeRange());
  const [text, setText] = useState('{}');
  const [error, setError] = useState<string>();
  const datasource = selection.datasource ?? ref;
  const uid = typeof datasource === 'string' ? datasource : datasource?.uid;

  function apply() {
    if (!uid) {
      return;
    }
    try {
      const value: unknown = JSON.parse(text);
      if (!isRecord(value) || Array.isArray(value) || schema?.validate({ ...value, ...selection.extraProps }).length) {
        setError(t('plugins.catalog-preview.invalid-props', 'Enter an object matching the component input schema.'));
        return;
      }
      onApply({ datasource, timeRange: selection.timeRange ?? range, extraProps: value });
    } catch {
      setError(t('plugins.catalog-preview.invalid-json', 'Enter valid JSON.'));
    }
  }

  return (
    <Stack direction="column">
      {!selection.datasource && (
        <Field label={t('plugins.catalog-preview.datasource', 'Data source')} htmlFor={inputId}>
          <DataSourcePicker
            inputId={inputId}
            current={ref}
            type={entry.datasource}
            noDefault
            onChange={({ uid, type }) => setRef({ uid, type })}
          />
        </Field>
      )}
      {!selection.timeRange && (
        <Field label={t('plugins.catalog-preview.time-range', 'Time range')}>
          <TimeRangeInput value={range} onChange={setRange} />
        </Field>
      )}
      {schema && (
        <Field
          label={t('plugins.catalog-preview.props', 'Additional inputs (JSON)')}
          htmlFor={`${inputId}-props`}
          description={<code>{JSON.stringify(entry.props)}</code>}
          invalid={Boolean(error)}
          error={error}
        >
          <TextArea id={`${inputId}-props`} value={text} onChange={(event) => setText(event.currentTarget.value)} />
        </Field>
      )}
      <Button type="button" disabled={!uid} onClick={apply}>
        <Trans i18nKey="plugins.catalog-preview.show">Show preview</Trans>
      </Button>
    </Stack>
  );
}
