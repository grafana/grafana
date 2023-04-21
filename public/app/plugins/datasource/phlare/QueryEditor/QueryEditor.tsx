import { defaults } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, QueryEditorProps } from '@grafana/data';
import { ButtonCascader, CascaderOption } from '@grafana/ui';

import { defaultPhlare, defaultPhlareQueryType, Phlare } from '../dataquery.gen';
import { PhlareDataSource } from '../datasource';
import { PhlareDataSourceOptions, ProfileTypeMessage, Query } from '../types';

import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { QueryOptions } from './QueryOptions';
import { ApiObject } from './autocomplete';

export type Props = QueryEditorProps<PhlareDataSource, Query, PhlareDataSourceOptions>;

export const defaultQuery: Partial<Phlare> = {
  ...defaultPhlare,
  queryType: defaultPhlareQueryType,
};

export function QueryEditor(props: Props) {
  const profileTypes = useProfileTypes(props.datasource);

  function onProfileTypeChange(value: string[], selectedOptions: CascaderOption[]) {
    if (selectedOptions.length === 0) {
      return;
    }

    const id = selectedOptions[selectedOptions.length - 1].value;

    // Probably cannot happen but makes TS happy
    if (typeof id !== 'string') {
      throw new Error('id is not string');
    }

    props.onChange({ ...props.query, profileTypeId: id });
  }

  function onLabelSelectorChange(value: string) {
    props.onChange({ ...props.query, labelSelector: value });
  }

  function handleRunQuery(value: string) {
    props.onChange({ ...props.query, labelSelector: value });
    props.onRunQuery();
  }

  // Round to nearest 5 seconds. If the range is something like last 1h then every render the range values change slightly
  // and what ever has range as dependency is rerun. So this effectively debounces the queries.
  const unpreciseRange = {
    to: Math.ceil((props.range?.to.valueOf() || 0) / 5000) * 5000,
    from: Math.floor((props.range?.from.valueOf() || 0) / 5000) * 5000,
  };

  const labelsResult = useAsync(() => {
    return props.datasource.getLabelNames(
      props.query.profileTypeId + props.query.labelSelector,
      unpreciseRange.from,
      unpreciseRange.to
    );
  }, [props.datasource, props.query.profileTypeId, props.query.labelSelector, unpreciseRange.to, unpreciseRange.from]);

  const cascaderOptions = useCascaderOptions(profileTypes);
  const selectedProfileName = useProfileName(profileTypes, props.query.profileTypeId);
  let query = normalizeQuery(props.query, props.app);

  const apiObject: ApiObject = useMemo(() => {
    return {
      getLabelValues: (label: string) => {
        return props.datasource.getLabelValues(
          props.query.profileTypeId + props.query.labelSelector,
          label,
          unpreciseRange.from,
          unpreciseRange.to
        );
      },
      getLabelNames: () => {
        return props.datasource.getLabelNames(
          props.query.profileTypeId + props.query.labelSelector,
          unpreciseRange.from,
          unpreciseRange.to
        );
      },
    };
  }, [props.datasource, unpreciseRange.to, unpreciseRange.from, props.query.labelSelector, props.query.profileTypeId]);

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
          apiObject={apiObject}
        />
      </EditorRow>
      <EditorRow>
        <QueryOptions query={query} onQueryChange={props.onChange} app={props.app} labels={labelsResult.value} />
      </EditorRow>
    </EditorRows>
  );
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

function useProfileTypes(datasource: PhlareDataSource) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>([]);
  useEffect(() => {
    (async () => {
      const profileTypes = await datasource.getProfileTypes();
      setProfileTypes(profileTypes);
    })();
  }, [datasource]);
  return profileTypes;
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
