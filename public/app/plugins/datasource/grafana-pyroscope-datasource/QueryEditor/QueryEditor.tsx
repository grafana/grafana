import deepEqual from 'fast-deep-equal';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, QueryEditorProps, TimeRange } from '@grafana/data';
import { Cascader, CascaderOption, LoadingPlaceholder } from '@grafana/ui';

import { normalizeQuery, PhlareDataSource } from '../datasource';
import { PhlareDataSourceOptions, ProfileTypeMessage, Query } from '../types';

import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { QueryOptions } from './QueryOptions';

export type Props = QueryEditorProps<PhlareDataSource, Query, PhlareDataSourceOptions>;

export function QueryEditor(props: Props) {
  const { onChange, onRunQuery, datasource, query, range, app } = props;

  function handleRunQuery(value: string) {
    onChange({ ...query, labelSelector: value });
    onRunQuery();
  }

  const profileTypes = useProfileTypes(datasource);
  const { labels, getLabelValues, onLabelSelectorChange } = useLabels(range, datasource, query, onChange);
  useNormalizeQuery(query, profileTypes, onChange, app);

  const cascaderOptions = useCascaderOptions(profileTypes);

  return (
    <EditorRows>
      <EditorRow stackProps={{ wrap: false, gap: 1 }}>
        {profileTypes ? (
          <Cascader
            separator={'-'}
            displayAllSelectedLevels={true}
            initialValue={query.profileTypeId}
            allowCustomValue={true}
            onSelect={(val) => {
              onChange({ ...query, profileTypeId: val });
            }}
            options={cascaderOptions}
          />
        ) : (
          <LoadingPlaceholder text={'Loading'} />
        )}
        <LabelsEditor
          value={query.labelSelector}
          onChange={onLabelSelectorChange}
          onRunQuery={handleRunQuery}
          labels={labels}
          getLabelValues={getLabelValues}
        />
      </EditorRow>
      <EditorRow>
        <QueryOptions query={query} onQueryChange={props.onChange} app={props.app} labels={labels} />
      </EditorRow>
    </EditorRows>
  );
}

function useNormalizeQuery(
  query: Query,
  profileTypes: ProfileTypeMessage[] | undefined,
  onChange: (value: Query) => void,
  app?: CoreApp
) {
  useEffect(() => {
    if (!profileTypes) {
      return;
    }
    const normalizedQuery = normalizeQuery(query, app);
    // We just check if profileTypeId is filled but don't check if it's one of the existing cause it can be template
    // variable
    if (!query.profileTypeId) {
      normalizedQuery.profileTypeId = defaultProfileType(profileTypes);
    }
    // Makes sure we don't have an infinite loop updates because the normalization creates a new object
    if (!deepEqual(query, normalizedQuery)) {
      onChange(normalizedQuery);
    }
  }, [app, query, profileTypes, onChange]);
}

function defaultProfileType(profileTypes: ProfileTypeMessage[]): string {
  const cpuProfiles = profileTypes.filter((p) => p.id.indexOf('cpu') >= 0);
  if (cpuProfiles.length) {
    // Prefer cpu time profile if available instead of samples
    const cpuTimeProfile = cpuProfiles.find((p) => p.id.indexOf('samples') === -1);
    if (cpuTimeProfile) {
      return cpuTimeProfile.id;
    }
    // Fallback to first cpu profile type
    return cpuProfiles[0].id;
  }

  // Fallback to first profile type from response data
  return profileTypes[0].id;
}

function useLabels(
  range: TimeRange | undefined,
  datasource: PhlareDataSource,
  query: Query,
  onChange: (value: Query) => void
) {
  // Round to nearest 5 seconds. If the range is something like last 1h then every render the range values change slightly
  // and what ever has range as dependency is rerun. So this effectively debounces the queries.
  const unpreciseRange = {
    to: Math.ceil((range?.to.valueOf() || 0) / 5000) * 5000,
    from: Math.floor((range?.from.valueOf() || 0) / 5000) * 5000,
  };

  const labelsResult = useAsync(() => {
    return datasource.getLabelNames(query.profileTypeId + query.labelSelector, unpreciseRange.from, unpreciseRange.to);
  }, [datasource, query.profileTypeId, query.labelSelector, unpreciseRange.to, unpreciseRange.from]);

  // Create a function with range and query already baked in so we don't have to send those everywhere
  const getLabelValues = useCallback(
    (label: string) => {
      return datasource.getLabelValues(
        query.profileTypeId + query.labelSelector,
        label,
        unpreciseRange.from,
        unpreciseRange.to
      );
    },
    [query, datasource, unpreciseRange.to, unpreciseRange.from]
  );

  const onLabelSelectorChange = useCallback(
    (value: string) => {
      onChange({ ...query, labelSelector: value });
    },
    [onChange, query]
  );

  return { labels: labelsResult.value, getLabelValues, onLabelSelectorChange };
}

// Turn profileTypes into cascader options
function useCascaderOptions(profileTypes?: ProfileTypeMessage[]): CascaderOption[] {
  return useMemo(() => {
    if (!profileTypes) {
      return [];
    }
    let mainTypes = new Map<string, CascaderOption>();
    // Classify profile types by name then sample type.
    for (let profileType of profileTypes) {
      let parts: string[];
      // Phlare uses : as delimiter while Pyro uses .
      if (profileType.id.indexOf(':') > -1) {
        parts = profileType.id.split(':');
      } else {
        parts = profileType.id.split('.');
        const last = parts.pop()!;
        parts = [parts.join('.'), last];
      }

      const [name, type] = parts;

      if (!mainTypes.has(name)) {
        mainTypes.set(name, {
          label: name,
          value: name,
          items: [],
        });
      }
      mainTypes.get(name)?.items!.push({
        label: type,
        value: profileType.id,
      });
    }
    return Array.from(mainTypes.values());
  }, [profileTypes]);
}

function useProfileTypes(datasource: PhlareDataSource) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>();

  useEffect(() => {
    (async () => {
      const profileTypes = await datasource.getProfileTypes();
      setProfileTypes(profileTypes);
    })();
  }, [datasource]);

  return profileTypes;
}
