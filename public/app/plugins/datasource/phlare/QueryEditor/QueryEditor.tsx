import { defaults } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, QueryEditorProps, TimeRange } from '@grafana/data';
import { ButtonCascader, CascaderOption } from '@grafana/ui';

import { defaultPhlare, defaultPhlareQueryType, Phlare } from '../dataquery.gen';
import { PhlareDataSource } from '../datasource';
import { PhlareDataSourceOptions, ProfileTypeMessage, Query } from '../types';

import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { QueryOptions } from './QueryOptions';

export type Props = QueryEditorProps<PhlareDataSource, Query, PhlareDataSourceOptions>;

export const defaultQuery: Partial<Phlare> = {
  ...defaultPhlare,
  queryType: defaultPhlareQueryType,
};

export function QueryEditor(props: Props) {
  let query = normalizeQuery(props.query, props.app);

  function handleRunQuery(value: string) {
    props.onChange({ ...props.query, labelSelector: value });
    props.onRunQuery();
  }

  const { profileTypes, onProfileTypeChange, selectedProfileName } = useProfileTypes(
    props.datasource,
    props.query,
    props.onChange
  );
  const { labels, getLabelValues, onLabelSelectorChange } = useLabels(
    props.range,
    props.datasource,
    props.query,
    props.onChange
  );
  const cascaderOptions = useCascaderOptions(profileTypes);

  return (
    <EditorRows>
      <EditorRow stackProps={{ wrap: false, gap: 1 }}>
        <ButtonCascader onChange={onProfileTypeChange} options={cascaderOptions} buttonProps={{ variant: 'secondary' }}>
          {selectedProfileName}
        </ButtonCascader>
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
function useCascaderOptions(profileTypes: ProfileTypeMessage[]) {
  return useMemo(() => {
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
          value: profileType.id,
          children: [],
        });
      }
      mainTypes.get(name)?.children?.push({
        label: type,
        value: profileType.id,
      });
    }
    return Array.from(mainTypes.values());
  }, [profileTypes]);
}

function useProfileTypes(datasource: PhlareDataSource, query: Query, onChange: (value: Query) => void) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>([]);

  useEffect(() => {
    (async () => {
      const profileTypes = await datasource.getProfileTypes();
      setProfileTypes(profileTypes);
    })();
  }, [datasource]);

  const onProfileTypeChange = useCallback(
    (value: string[], selectedOptions: CascaderOption[]) => {
      if (selectedOptions.length === 0) {
        return;
      }

      const id = selectedOptions[selectedOptions.length - 1].value;

      // Probably cannot happen but makes TS happy
      if (typeof id !== 'string') {
        throw new Error('id is not string');
      }

      onChange({ ...query, profileTypeId: id });
    },
    [onChange, query]
  );

  const selectedProfileName = useProfileName(profileTypes, query.profileTypeId);

  return { profileTypes, onProfileTypeChange, selectedProfileName };
}

function useProfileName(profileTypes: ProfileTypeMessage[], profileTypeId: string) {
  return useMemo(() => {
    if (!profileTypes) {
      return 'Loading';
    }
    const profile = profileTypes.find((type) => type.id === profileTypeId);
    if (!profile) {
      return 'Select a profile type';
    }

    return profile.label;
  }, [profileTypeId, profileTypes]);
}

export function normalizeQuery(query: Query, app?: CoreApp | string) {
  let normalized = defaults(query, defaultQuery);
  if (app !== CoreApp.Explore && normalized.queryType === 'both') {
    // In dashboards and other places, we can't show both types of graphs at the same time.
    // This will also be a default when having 'both' query and adding it from explore to dashboard
    normalized.queryType = 'profile';
  }
  return normalized;
}
