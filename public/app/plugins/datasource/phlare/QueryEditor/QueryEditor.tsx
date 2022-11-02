import { defaults } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, QueryEditorProps } from '@grafana/data';
import { ButtonCascader, CascaderOption } from '@grafana/ui';

import { FireDataSource } from '../datasource';
import { defaultQuery, FireDataSourceOptions, ProfileTypeMessage, Query } from '../types';

import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { QueryOptions } from './QueryOptions';

export type Props = QueryEditorProps<FireDataSource, Query, FireDataSourceOptions>;

export function QueryEditor(props: Props) {
  const profileTypes = useProfileTypes(props.datasource);

  function onProfileTypeChange(value: string[], selectedOptions: CascaderOption[]) {
    if (selectedOptions.length === 0) {
      return;
    }

    const id = selectedOptions[selectedOptions.length - 1].value;

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

  const seriesResult = useAsync(() => {
    return props.datasource.getSeries();
  }, [props.datasource]);

  const cascaderOptions = useCascaderOptions(profileTypes);
  const selectedProfileName = useProfileName(profileTypes, props.query.profileTypeId);
  let query = normalizeQuery(props.query, props.app);

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
          series={seriesResult.value}
        />
      </EditorRow>
      <EditorRow>
        <QueryOptions query={query} onQueryChange={props.onChange} app={props.app} series={seriesResult.value} />
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
      if (!mainTypes.has(profileType.name)) {
        mainTypes.set(profileType.name, {
          label: profileType.name,
          value: profileType.ID,
          children: [],
        });
      }
      mainTypes.get(profileType.name)?.children?.push({
        label: profileType.sample_type,
        value: profileType.ID,
      });
    }
    return Array.from(mainTypes.values());
  }, [profileTypes]);
}

function useProfileTypes(datasource: FireDataSource) {
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
    const profile = profileTypes.find((type) => type.ID === profileTypeId);
    if (!profile) {
      return 'Select a profile type';
    }

    return profile.name + ' - ' + profile.sample_type;
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
