import { useEffect, useMemo, useState } from 'react';

import { Cascader, CascaderOption } from '@grafana/ui';

import { PyroscopeDataSource } from './datasource';
import { ProfileTypeMessage } from './types';

type Props = {
  initialProfileTypeId?: string;
  profileTypes?: ProfileTypeMessage[];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number;
};

export function ProfileTypesCascader(props: Props) {
  const cascaderOptions = useCascaderOptions(props.profileTypes);

  return (
    <Cascader
      placeholder={props.placeholder}
      separator={'-'}
      displayAllSelectedLevels={true}
      initialValue={props.initialProfileTypeId}
      allowCustomValue={true}
      onSelect={props.onChange}
      options={cascaderOptions}
      changeOnSelect={false}
      width={props.width ?? 26}
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
    // The profileTypes are something like cpu:sample:nanoseconds:sample:count or app.something.something
    for (let profileType of profileTypes) {
      let parts: string[] = [];
      if (profileType.id.indexOf(':') > -1) {
        parts = profileType.id.split(':');
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

/**
 * Loads the profile types.
 *
 * This is exported and not used directly in the ProfileTypesCascader component because in some case we need to know
 * the profileTypes before rendering the cascader.
 * @param datasource
 */
export function useProfileTypes(datasource: PyroscopeDataSource) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>();

  useEffect(() => {
    (async () => {
      const profileTypes = await datasource.getProfileTypes();
      setProfileTypes(profileTypes);
    })();
  }, [datasource]);

  return profileTypes;
}
