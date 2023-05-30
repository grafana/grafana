import React from 'react';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { DocsLinkButton } from 'app/core/components/DocsLinkButton';

import { TempoJsonData } from '../types';

import { getStyles } from './QuerySettings';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function SearchSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <h3 className="page-heading">Tempo search</h3>

      <div className={styles.infoText}>
        Modify how traces are searched
        <DocsLinkButton hrefSuffix="tempo/#tempo-search" />
      </div>

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
