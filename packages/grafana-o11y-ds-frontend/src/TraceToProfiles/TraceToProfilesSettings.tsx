import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { useAsync } from 'react-use';

import {
  DataSourceJsonData,
  DataSourceInstanceSettings,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigDescriptionLink, ConfigSection } from '@grafana/plugin-ui';
import { DataSourcePicker, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Input, InlineSwitch } from '@grafana/ui';

import { TagMappingInput } from '../TraceToLogs/TagMappingInput';
import { ProfileTypesCascader } from '../pyroscope/ProfileTypesCascader';
import { ProfileTypeMessage } from '../pyroscope/types';

export interface TraceToProfilesOptions {
  datasourceUid?: string;
  tags?: Array<{ key: string; value?: string }>;
  query?: string;
  profileTypeId?: string;
  customQuery: boolean;
}

export interface TraceToProfilesData extends DataSourceJsonData {
  tracesToProfiles?: TraceToProfilesOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToProfilesData> {}

export function TraceToProfilesSettings({ options, onOptionsChange }: Props) {
  const supportedDataSourceTypes = useMemo(() => ['grafana-pyroscope-datasource'], []);

  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>([]);
  const profileTypesPlaceholder = useMemo(() => {
    let placeholder = profileTypes.length === 0 ? 'No profile types found' : 'Select profile type';
    if (!options.jsonData.tracesToProfiles?.datasourceUid) {
      placeholder = 'Please select profiling data source';
    }
    return placeholder;
  }, [options.jsonData.tracesToProfiles?.datasourceUid, profileTypes]);

  const { value: dataSource } = useAsync(async () => {
    return await getDataSourceSrv().get(options.jsonData.tracesToProfiles?.datasourceUid);
  }, [options.jsonData.tracesToProfiles?.datasourceUid]);

  const { value: pTypes } = useAsync(async () => {
    if (
      dataSource instanceof DataSourceWithBackend &&
      supportedDataSourceTypes.includes(dataSource.type) &&
      dataSource.uid === options.jsonData.tracesToProfiles?.datasourceUid
    ) {
      return await dataSource?.getResource('profileTypes');
    }
  }, [dataSource]);

  useEffect(() => {
    setProfileTypes(pTypes ?? []);
  }, [pTypes]);

  return (
    <div className={css({ width: '100%' })}>
      <InlineFieldRow>
        <InlineField
          tooltip="The profiles data source the trace is going to navigate to"
          label="Data source"
          labelWidth={26}
        >
          <DataSourcePicker
            inputId="trace-to-profiles-data-source-picker"
            filter={(ds) => supportedDataSourceTypes.includes(ds.type)}
            current={options.jsonData.tracesToProfiles?.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds: DataSourceInstanceSettings) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToProfiles', {
                ...options.jsonData.tracesToProfiles,
                datasourceUid: ds.uid,
              });
            }}
            onClear={() => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToProfiles', {
                ...options.jsonData.tracesToProfiles,
                datasourceUid: undefined,
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          tooltip="Tags that will be used in the query. Default tags: 'service.name', 'service.namespace'"
          label="Tags"
          labelWidth={26}
        >
          <TagMappingInput
            values={options.jsonData.tracesToProfiles?.tags ?? []}
            onChange={(v) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToProfiles', {
                ...options.jsonData.tracesToProfiles,
                tags: v,
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField tooltip="Profile type that will be used in the query" label="Profile type" labelWidth={26}>
          <ProfileTypesCascader
            profileTypes={profileTypes}
            placeholder={profileTypesPlaceholder}
            initialProfileTypeId={options.jsonData.tracesToProfiles?.profileTypeId}
            onChange={(val) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToProfiles', {
                ...options.jsonData.tracesToProfiles,
                profileTypeId: val,
              });
            }}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          tooltip="Use a custom query with the possibility to interpolate variables from the trace or span"
          label="Use custom query"
          labelWidth={26}
        >
          <InlineSwitch
            id={'profilesCustomQuerySwitch'}
            value={options.jsonData.tracesToProfiles?.customQuery}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToProfiles', {
                ...options.jsonData.tracesToProfiles,
                customQuery: event.currentTarget.checked,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>

      {options.jsonData.tracesToProfiles?.customQuery && (
        <InlineField
          label="Query"
          labelWidth={26}
          tooltip="The query that will run when navigating from a trace to profiles data source. Interpolate tags using the `$__tags` keyword"
          grow
        >
          <Input
            label="Query"
            type="text"
            allowFullScreen
            value={options.jsonData.tracesToProfiles?.query || ''}
            onChange={(e) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToProfiles', {
                ...options.jsonData.tracesToProfiles,
                query: e.currentTarget.value,
              })
            }
          />
        </InlineField>
      )}
    </div>
  );
}

export const TraceToProfilesSection = ({ options, onOptionsChange }: DataSourcePluginOptionsEditorProps) => {
  return (
    <ConfigSection
      title="Trace to profiles"
      description={
        <ConfigDescriptionLink
          description="Navigate from a trace span to the selected data source's profiles."
          suffix={`${options.type}/configure-tempo-data-source/#trace-to-profiles`}
          feature="trace to profiles"
        />
      }
      isCollapsible={true}
      isInitiallyOpen={true}
    >
      <TraceToProfilesSettings options={options} onOptionsChange={onOptionsChange} />
    </ConfigSection>
  );
};
