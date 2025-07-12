import * as React from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';

import { TempoJsonData } from '../types';

import { getStyles } from './QuerySettings';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function TagsTimeRangeSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <InlineFieldRow className={styles.row}>
        <InlineField
          tooltip="Enable time range in tags and tag value queries"
          label="Use time range in query"
          labelWidth={26}
        >
          <InlineSwitch
            id="includeTimeRangeForTags"
            value={options.jsonData.includeTimeRangeForTags}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateDatasourcePluginJsonDataOption(
                { onOptionsChange, options },
                'includeTimeRangeForTags',
                event.currentTarget.checked
              )
            }
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}
