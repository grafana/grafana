import React from 'react';
import useAsync from 'react-use/lib/useAsync';

import { DataSourcePluginOptionsEditorProps, updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { DocsLinkButton } from 'app/core/components/DocsLinkButton';

import { TempoDatasource } from '../datasource';
import { TempoJsonData } from '../types';

import { getStyles } from './QuerySettings';
import { TraceQLSearchTags } from './TraceQLSearchTags';

interface Props extends DataSourcePluginOptionsEditorProps<TempoJsonData> {}

export function TraceQLSearchSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);
  const dataSourceSrv = getDataSourceSrv();
  const fetchDatasource = async () => {
    return (await dataSourceSrv.get({ type: options.type, uid: options.uid })) as TempoDatasource;
  };

  const { value: datasource } = useAsync(fetchDatasource, [dataSourceSrv, options]);

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
      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="Configures which fields are available in the UI" label="Static filters" labelWidth={26}>
          <TraceQLSearchTags datasource={datasource} options={options} onOptionsChange={onOptionsChange} />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}
