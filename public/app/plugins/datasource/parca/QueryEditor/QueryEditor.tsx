import { defaults } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useMount } from 'react-use';

import { CoreApp, QueryEditorProps } from '@grafana/data';
import { ButtonCascader, CascaderOption } from '@grafana/ui';

import { defaultParca, defaultParcaQueryType, Parca } from '../dataquery.gen';
import { ParcaDataSource } from '../datasource';
import { ParcaDataSourceOptions, ProfileTypeMessage, Query } from '../types';

import { EditorRow } from './EditorRow';
import { EditorRows } from './EditorRows';
import { LabelsEditor } from './LabelsEditor';
import { QueryOptions } from './QueryOptions';

export type Props = QueryEditorProps<ParcaDataSource, Query, ParcaDataSourceOptions>;

export const defaultQuery: Partial<Parca> = {
  ...defaultParca,
  queryType: defaultParcaQueryType,
};

export function QueryEditor(props: Props) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>([]);

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

  useMount(async () => {
    const profileTypes = await props.datasource.getProfileTypes();
    setProfileTypes(profileTypes);
  });

  // Turn profileTypes into cascader options
  const cascaderOptions = useMemo(() => {
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

  const selectedProfileName = useMemo(() => {
    if (!profileTypes) {
      return 'Loading';
    }
    const profile = profileTypes.find((type) => type.ID === props.query.profileTypeId);
    if (!profile) {
      return 'Select a profile type';
    }

    return profile.name + ' - ' + profile.sample_type;
  }, [props.query.profileTypeId, profileTypes]);

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
          datasource={props.datasource}
          onRunQuery={handleRunQuery}
        />
      </EditorRow>
      <EditorRow>
        <QueryOptions
          query={query}
          onQueryTypeChange={(val) => {
            props.onChange({ ...query, queryType: val });
          }}
          app={props.app}
        />
      </EditorRow>
    </EditorRows>
  );
}

function normalizeQuery(query: Query, app?: CoreApp) {
  let normalized = defaults(query, defaultQuery);
  if (app !== CoreApp.Explore && normalized.queryType === 'both') {
    // In dashboards and other places, we can't show both types of graphs at the same time.
    // This will also be a default when having 'both' query and adding it from explore to dashboard
    normalized.queryType = 'profile';
  }
  return normalized;
}
