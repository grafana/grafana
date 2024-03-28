import deepEqual from 'fast-deep-equal';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CoreApp, QueryEditorProps, TimeRange } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';

import { normalizeQuery, PyroscopeDataSource } from '../datasource';
import { ProfileTypeMessage, PyroscopeDataSourceOptions, Query } from '../types';

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

  const onLabelSelectorChange = useLabelSelector(query, onChange);

  const profileTypes = useProfileTypes(datasource, range);
  const { labels, getLabelValues } = useLabels(range, datasource, query);
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
          onRunQuery={handleRunQuery}
          labels={labels}
          getLabelValues={getLabelValues}
        />
        <PyroscopeQueryLinkExtensions {...props} />
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
  return profileTypes[0]?.id || '';
}

function useLabels(range: TimeRange | undefined, datasource: PyroscopeDataSource, query: Query) {
  // Round to nearest 5 seconds. If the range is something like last 1h then every render the range values change slightly
  // and what ever has range as dependency is rerun. So this effectively debounces the queries.
  const unpreciseRange = {
    to: Math.ceil((range?.to.valueOf() || 0) / 10000) * 10000,
    from: Math.floor((range?.from.valueOf() || 0) / 10000) * 10000,
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

  const [labels, setLabels] = useState(() => ['']);

  useEffect(() => {
    const fetchData = async () => {
      const labels = await datasource.getLabelNames(
        createSelector(query.labelSelector, query.profileTypeId, ''),
        unpreciseRange.from,
        unpreciseRange.to
      );

      setLabels(labels);
    };
    fetchData();
  }, [query, unpreciseRange.from, unpreciseRange.to, datasource, setLabels]);

  // Create a function with range and query already baked in, so we don't have to send those everywhere
  const getLabelValues = useCallback(
    (label: string) => {
      const labelSelector = createSelector(query.labelSelector, query.profileTypeId, label);
      return datasource.getLabelValues(labelSelector, label, unpreciseRange.from, unpreciseRange.to);
    },
    [datasource, query.labelSelector, query.profileTypeId, unpreciseRange.to, unpreciseRange.from]
  );

  return { labels, getLabelValues };
}

function useLabelSelector(query: Query, onChange: (value: Query) => void) {
  // Need to reference the query as otherwise when the label selector is changed, only the initial value
  // of the query is passed into the LabelsEditor (onChange) which renders the CodeEditor for monaco.
  // The above needs to have a ref to the query so it can get the latest value.
  const queryRef = useRef(query);
  queryRef.current = query;

  const onChangeDebounced = debounce((value: string) => {
    if (onChange) {
      onChange({ ...queryRef.current, labelSelector: value });
    }
  }, 200);

  const onLabelSelectorChange = useCallback(
    (value: string) => {
      onChangeDebounced(value);
    },
    [onChangeDebounced]
  );

  return onLabelSelectorChange;
}
