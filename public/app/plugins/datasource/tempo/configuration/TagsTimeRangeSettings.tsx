import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { Combobox, InlineField, InlineFieldRow, useStyles2 } from '@grafana/ui';

import { TempoJsonData } from '../types';

import { getStyles } from './QuerySettings';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export const DEFAULT_TIME_RANGE_FOR_TAGS = 1800; // 60 * 30

export function TagsTimeRangeSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  const selectOptions = [
    { label: 'Last 30 minutes of selected range', value: DEFAULT_TIME_RANGE_FOR_TAGS },
    { label: 'Last 3 hours of selected range', value: 10800 }, // 60 * 60 * 3
    { label: 'Last 24 hours of selected range', value: 86400 }, // 60 * 60 * 24
    { label: 'Last 3 days of selected range', value: 259200 }, // 60 * 60 * 24 * 3
    { label: 'Last 7 days of selected range', value: 604800 }, // 60 * 60 * 24 * 7
  ];

  return (
    <div className={styles.container}>
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Time range in tags and tag value queries" label="Time range in query" labelWidth={26}>
          <Combobox
            id="time-range-for-tags-select"
            options={selectOptions}
            value={options.jsonData?.timeRangeForTags || DEFAULT_TIME_RANGE_FOR_TAGS}
            onChange={(v) => {
              updateDatasourcePluginJsonDataOption(
                { onOptionsChange, options },
                'timeRangeForTags',
                v?.value ?? DEFAULT_TIME_RANGE_FOR_TAGS
              );
            }}
            placeholder="Time range for tags"
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}
