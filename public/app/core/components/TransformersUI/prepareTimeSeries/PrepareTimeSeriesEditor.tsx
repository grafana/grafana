import React, { useCallback } from 'react';
import { GrafanaTheme2, SelectableValue, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { prepareTimeSeriesTransformer, PrepareTimeSeriesOptions, timeSeriesFormat } from './prepareTimeSeries';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

const wideInfo = {
  label: 'Wide time series',
  value: timeSeriesFormat.TimeSeriesWide,
  description: 'Creates a single frame joined by time',
  info: (
    <ul>
      <li>Single frame</li>
      <li>1st field is shared time field</li>
      <li>Time in ascending order</li>
      <li>Multiple value fields of any type</li>
    </ul>
  ),
};

const manyInfo = {
  label: 'Multi-frame time series',
  value: timeSeriesFormat.TimeSeriesMany,
  description: 'Creates a new frame for each time/number pair',
  info: (
    <ul>
      <li>Multiple frames</li>
      <li>Each frame has two fields: time, value</li>
      <li>Time in ascending order</li>
      <li>All values are numeric</li>
    </ul>
  ),
};

const formats: Array<SelectableValue<timeSeriesFormat>> = [wideInfo, manyInfo];

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
        <InlineField label="Format" labelWidth={12}>
          <Select
            width={35}
            options={formats}
            value={formats.find((v) => v.value === options.format) || formats[0]}
            onChange={onSelectFormat}
            className="flex-grow-1"
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Info" labelWidth={12}>
          <div className={styles.info}>
            {options.format === timeSeriesFormat.TimeSeriesMany ? manyInfo.info : wideInfo.info}
          </div>
        </InlineField>
      </InlineFieldRow>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css`
    margin-left: 20px;
  `,
});

export const prepareTimeseriesTransformerRegistryItem: TransformerRegistryItem<PrepareTimeSeriesOptions> = {
  id: prepareTimeSeriesTransformer.id,
  editor: PrepareTimeSeriesEditor,
  transformation: prepareTimeSeriesTransformer,
  name: prepareTimeSeriesTransformer.name,
  description: prepareTimeSeriesTransformer.description,
  help: `
  ### Use cases 
  
  This will take query results and transform them into a predictable timeseries format.  
  This transformer may be especially useful when using old panels that only expect the
  many-frame timeseries format.
  `,
};
