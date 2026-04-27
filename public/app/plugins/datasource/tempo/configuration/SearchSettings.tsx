import * as React from 'react';

import type { DataSourcePluginOptionsEditorProps } from '@grafana/data/types';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data/utils';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { type TempoJsonData } from '../types';

import { getStyles } from './QuerySettings';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function SearchSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Removes the search tab from the query editor" label="Hide search" labelWidth={26}>
          <InlineSwitch
            id="hideSearch"
            value={options.jsonData.search?.hide}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', {
                ...options.jsonData.search,
                hide: event.currentTarget.checked,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}
