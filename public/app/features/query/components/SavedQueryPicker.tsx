// Libraries
import React, { useMemo } from 'react';
// Components
import { useAsync } from 'react-use';
import { AsyncState } from 'react-use/lib/useAsyncFn';

import { DataSourceInstanceSettings, isUnsignedPluginSignature, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime/src';
import { HorizontalGroup, PluginSignatureBadge, Select } from '@grafana/ui';

import { getGrafanaSearcher, QueryResponse, SearchQuery } from '../../search/service';

export type SavedQueryPickerProps = {
  onChange: (savedQueryUid: string | null) => void;
  current?: string | null; // type
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
};

function getSavedQueryPickerOptions(results: AsyncState<QueryResponse>): Array<SelectableValue<string>> {
  if (results?.loading) {
    return [];
  }

  if (!results?.value?.totalRows) {
    return [];
  }

  const hits = results.value.view.toArray();

  return hits.map((h) => {
    const dsSettings = h.ds_uid?.length ? getDataSourceSrv().getInstanceSettings(h.ds_uid[0]) : undefined;

    return {
      value: h.uid,
      label: h.name,
      imgUrl: dsSettings?.meta.info.logos.small,
      meta: dsSettings?.meta,
    };
  });
}

export const SavedQueryPicker = (props: SavedQueryPickerProps) => {
  const { autoFocus, onBlur, onChange, current, openMenuOnFocus, placeholder, width, inputId } = props;

  const searchQuery = useMemo<SearchQuery>(() => {
    // TODO: ensure we fetch all saved queries?
    const query: SearchQuery = {
      query: '*',
      explain: true,
      kind: ['query'],
    };

    return query;
  }, []);

  const results = useAsync(async () => {
    return getGrafanaSearcher().search(searchQuery);
  }, [searchQuery]);

  const options = getSavedQueryPickerOptions(results);

  return (
    <div aria-label={selectors.components.DataSourcePicker.container}>
      <Select
        aria-label={selectors.components.DataSourcePicker.inputV2}
        inputId={inputId || 'data-source-picker'}
        className="ds-picker select-container"
        isMulti={false}
        isClearable={true}
        backspaceRemovesValue={true}
        options={options}
        autoFocus={autoFocus}
        onBlur={onBlur}
        width={width}
        value={current}
        onChange={(newValue) => {
          onChange(newValue?.value ?? null);
        }}
        openMenuOnFocus={openMenuOnFocus}
        maxMenuHeight={500}
        placeholder={placeholder ?? 'Select query from the library'}
        noOptionsMessage="No queries found"
        getOptionLabel={(o) => {
          if (o.meta && isUnsignedPluginSignature(o.meta.signature)) {
            return (
              <HorizontalGroup align="center" justify="space-between">
                <span>{o.label}</span> <PluginSignatureBadge status={o.meta.signature} />
              </HorizontalGroup>
            );
          }
          return o.label || '';
        }}
      />
    </div>
  );
};
