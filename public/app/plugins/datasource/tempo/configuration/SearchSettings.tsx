import { css } from '@emotion/css';
import React from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';

import { TempoJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function SearchSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <h3 className="page-heading">Search</h3>
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Removes the Search tab from the Tempo query editor." label="Hide search" labelWidth={26}>
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

const getStyles = () => ({
  container: css`
    label: container;
    width: 100%;
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
});
