import React, { useEffect, useMemo, useState } from 'react';

import { Cascader, CascaderOption } from '@grafana/ui';

import { PhlareDataSource } from '../datasource';
import { ProfileTypeMessage } from '../types';

type Props = {
  initialProfileTypeId?: string;
  profileTypes?: ProfileTypeMessage[];
  onChange: (value: string) => void;
};

export function ProfileTypesCascader(props: Props) {
  const cascaderOptions = useCascaderOptions(props.profileTypes);

  return (
    <Cascader
      separator={'-'}
      displayAllSelectedLevels={true}
      initialValue={props.initialProfileTypeId}
      allowCustomValue={true}
      onSelect={props.onChange}
      options={cascaderOptions}
    />
  );
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

export function useProfileTypes(datasource: PhlareDataSource) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>();

  useEffect(() => {
    (async () => {
      const profileTypes = await datasource.getProfileTypes();
      setProfileTypes(profileTypes);
    })();
  }, [datasource]);

  return profileTypes;
}
