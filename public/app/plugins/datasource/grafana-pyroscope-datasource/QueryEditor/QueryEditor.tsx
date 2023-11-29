import deepEqual from 'fast-deep-equal';
import React, { useCallback, useEffect, useState } from 'react';

import { CoreApp, QueryEditorProps, TimeRange } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';

import { normalizeQuery, PyroscopeDataSource } from '../datasource';
import { PyroscopeDataSourceOptions, ProfileTypeMessage, Query } from '../types';

import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { ProfileTypesCascader, useProfileTypes } from './ProfileTypesCascader';
import { PyroscopeQueryLinkExtensions } from './QueryLinkExtension';
import { QueryOptions } from './QueryOptions';

export type Props = QueryEditorProps<PyroscopeDataSource, Query, PyroscopeDataSourceOptions>;

const labelSelectorRegex = /(\w+)\s*=\s*("[^,"]+")/g;

export function QueryEditor(props: Props) {
  const { onChange, onRunQuery, datasource, query, range, app } = props;

  function handleRunQuery(value: string) {
    onChange({ ...query, labelSelector: value });
    onRunQuery();
  }

  const profileTypes = useProfileTypes(datasource);
  const { getLabelNames, getLabelValues, onLabelSelectorChange, onBlur } = useLabels(
    range,
    datasource,
    query,
    onChange
  );
  useNormalizeQuery(query, profileTypes, onChange, app);

  let cascader = <LoadingPlaceholder text={'Loading'} />;

  // The cascader is uncontrolled component so if we want to set some default value we can do it only on initial
  // render, so we are waiting until we have the profileTypes and know what the default value should be before
  // rendering.
  if (profileTypes && query.profileTypeId !== undefined) {
    cascader = (
      <ProfileTypesCascader
        placeholder={profileTypes.length === 0 ? 'No profile types found' : 'Select profile type'}
        profileTypes={profileTypes}
        initialProfileTypeId={query.profileTypeId}
        onChange={(val) => {
          onChange({ ...query, profileTypeId: val });
        }}
      />
    );
  }

  return (
    <EditorRows>
      <EditorRow stackProps={{ wrap: false, gap: 1 }}>
        {cascader}
        <LabelsEditor
          value={query.labelSelector}
          onChange={onLabelSelectorChange}
          onBlur={onBlur}
          onRunQuery={handleRunQuery}
          getLabelNames={getLabelNames}
          getLabelValues={getLabelValues}
        />
        <PyroscopeQueryLinkExtensions {...props} />
      </EditorRow>
      <EditorRow>
        <QueryOptions query={query} onQueryChange={props.onChange} app={props.app} getLabelNames={getLabelNames} />
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
  return profileTypes[0]?.id || '';
}

function useLabels(
  range: TimeRange | undefined,
  datasource: PyroscopeDataSource,
  query: Query,
  onChange: (value: Query) => void
) {
  // Round to nearest 5 seconds. If the range is something like last 1h then every render the range values change slightly
  // and what ever has range as dependency is rerun. So this effectively debounces the queries.
  const unpreciseRange = {
    to: Math.ceil((range?.to.valueOf() || 0) / 5000) * 5000,
    from: Math.floor((range?.from.valueOf() || 0) / 5000) * 5000,
  };

  // Transforms user input into a valid label selector including the profile type.
  // It can optionally remove a label, used to support editing existing label values.
  const createSelector = (rawInput: string, profileTypeId: string, labelToRemove: string): string => {
    let labels: string[] = [`__profile_type__=\"${profileTypeId}\"`];
    let match;
    while ((match = labelSelectorRegex.exec(rawInput)) !== null) {
      if (match[1] && match[2]) {
        if (match[1] === labelToRemove) {
          continue;
        }
        labels.push(`${match[1]}=${match[2]}`);
      }
    }
    return `{${labels.join(',')}}`;
  };

  const [availableLabels, setAvailableLabels] = useState(() => ({ data: [] as string[] }));
  const [processedLabelSelector, setProcessedLabelSelector] = useState(() => ({
    data: createSelector(query.labelSelector, query.profileTypeId, ''),
  }));
  const [rawQuery, setRawQuery] = useState(() => ({ data: '' }));

  useEffect(() => {
    setProcessedLabelSelector({
      data: createSelector(rawQuery.data, query.profileTypeId, ''),
    });
  }, [rawQuery.data, query.profileTypeId]);

  const getLabelNames = useCallback(() => availableLabels.data, [availableLabels]);

  useEffect(() => {
    const fetchData = async () => {
      const labels = await datasource.getLabelNames(
        processedLabelSelector.data,
        unpreciseRange.from,
        unpreciseRange.to
      );

      setAvailableLabels({ data: labels });
    };
    fetchData();
  }, [processedLabelSelector.data, unpreciseRange.from, unpreciseRange.to, datasource, setAvailableLabels]);

  // Create a function with range and query already baked in, so we don't have to send those everywhere
  const getLabelValues = useCallback(
    (label: string) => {
      let labelSelector = createSelector(rawQuery.data, query.profileTypeId, label);
      console.log(labelSelector);
      const labelValues = datasource.getLabelValues(labelSelector, label, unpreciseRange.from, unpreciseRange.to);
      console.log(labelValues);
      return labelValues;
    },
    [datasource, rawQuery.data, query.profileTypeId, unpreciseRange.to, unpreciseRange.from]
  );

  const onLabelSelectorChange = useCallback(
    (value: string) => {
      setRawQuery({
        data: value,
      });
    },
    [setRawQuery]
  );

  // This is to update the query state, as updating it every time the value in the editor changes causes many things to rerender.
  const onBlur = useCallback(() => {
    onChange({ ...query, labelSelector: rawQuery.data });
  }, [query, onChange, rawQuery.data]);

  return { getLabelNames, getLabelValues, onLabelSelectorChange, onBlur };
}
