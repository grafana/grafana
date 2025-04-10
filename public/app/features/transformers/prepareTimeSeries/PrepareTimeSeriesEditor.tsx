import { css } from '@emotion/css';
import { useCallback } from 'react';
import * as React from 'react';

import {
  GrafanaTheme2,
  SelectableValue,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';

import { prepareTimeSeriesTransformer, PrepareTimeSeriesOptions, timeSeriesFormat } from './prepareTimeSeries';

const wideInfo = {
  label: 'Wide time series',
  value: timeSeriesFormat.TimeSeriesWide,
  description: 'Creates a single frame joined by time',
  info: (
    <ul>
      <li>
        <Trans i18nKey="transformers.wide-info.single-frame">Single frame</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.wide-info.st-field-is-shared-time">1st field is shared time field</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.wide-info.time-in-ascending-order">Time in ascending order</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.wide-info.multiple-value-fields-of-any-type">
          Multiple value fields of any type
        </Trans>
      </li>
    </ul>
  ),
};

const multiInfo = {
  label: 'Multi-frame time series',
  value: timeSeriesFormat.TimeSeriesMulti,
  description: 'Creates a new frame for each time/number pair',
  info: (
    <ul>
      <li>
        <Trans i18nKey="transformers.multi-info.multiple-frames">Multiple frames</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.multi-info.frame-fields-value" values={{ field1: 'time', field2: 'value' }}>
          Each frame has two fields: {'{{field1}}'}, {'{{field2}}'}
        </Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.multi-info.time-in-ascending-order">Time in ascending order</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.multi-info.string-values-are-represented-as-labels">
          String values are represented as labels
        </Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.multi-info.all-values-are-numeric">All values are numeric</Trans>
      </li>
    </ul>
  ),
};

const longInfo = {
  label: 'Long time series',
  value: timeSeriesFormat.TimeSeriesLong,
  description: 'Convert each frame to long format',
  info: (
    <ul>
      <li>
        <Trans i18nKey="transformers.long-info.single-frame">Single frame</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.long-info.st-field-is-time">1st field is time field</Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.long-info.ascending-order-duplicates">
          Time in ascending order, but may have duplicates
        </Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.long-info.string-values-separate">
          String values are represented as separate fields rather than as labels
        </Trans>
      </li>
      <li>
        <Trans i18nKey="transformers.long-info.multiple-value-fields-may-exist">Multiple value fields may exist</Trans>
      </li>
    </ul>
  ),
};

const formats: Array<SelectableValue<timeSeriesFormat>> = [wideInfo, multiInfo, longInfo];

export function PrepareTimeSeriesEditor(props: TransformerUIProps<PrepareTimeSeriesOptions>): React.ReactElement {
  const { options, onChange } = props;
  const styles = useStyles2(getStyles);

  const onSelectFormat = useCallback(
    (value: SelectableValue<timeSeriesFormat>) => {
      onChange({
        ...options,
        format: value.value!,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label={t('transformers.prepare-time-series-editor.label-format', 'Format')} labelWidth={12}>
          <Select
            width={35}
            options={formats}
            value={
              formats.find((v) => {
                // migrate previously selected timeSeriesMany to multi
                if (
                  v.value === timeSeriesFormat.TimeSeriesMulti &&
                  options.format === timeSeriesFormat.TimeSeriesMany
                ) {
                  return true;
                } else {
                  return v.value === options.format;
                }
              }) || formats[0]
            }
            onChange={onSelectFormat}
            className="flex-grow-1"
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={t('transformers.prepare-time-series-editor.label-info', 'Info')} labelWidth={12}>
          <div className={styles.info}>{(formats.find((v) => v.value === options.format) || formats[0]).info}</div>
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css({
    marginLeft: '20px',
  }),
});

export const prepareTimeseriesTransformerRegistryItem: TransformerRegistryItem<PrepareTimeSeriesOptions> = {
  id: prepareTimeSeriesTransformer.id,
  editor: PrepareTimeSeriesEditor,
  transformation: prepareTimeSeriesTransformer,
  name: prepareTimeSeriesTransformer.name,
  description: prepareTimeSeriesTransformer.description,
  categories: new Set([TransformerCategory.Reformat]),
  help: getTransformationContent(prepareTimeSeriesTransformer.id).helperDocs,
};
