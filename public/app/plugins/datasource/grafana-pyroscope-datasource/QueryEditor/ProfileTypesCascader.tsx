import React, { useEffect, useMemo, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { Cascader, CascaderOption } from '@grafana/ui';

import { PyroscopeDataSource } from '../datasource';
import { ProfileTypeMessage } from '../types';

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
 * @param range Time range for the profile types query.
 */
export function useProfileTypes(datasource: PyroscopeDataSource, range?: TimeRange) {
  const [profileTypes, setProfileTypes] = useState<ProfileTypeMessage[]>();

  const impreciseRange = {
    to: Math.ceil((range?.to.valueOf() || 0) / 60000) * 60000,
    from: Math.floor((range?.from.valueOf() || 0) / 60000) * 60000,
  };

  useEffect(() => {
    (async () => {
      const profileTypes = await datasource.getProfileTypes(impreciseRange.from.valueOf(), impreciseRange.to.valueOf());
      setProfileTypes(profileTypes);
    })();
  }, [datasource, impreciseRange.from, impreciseRange.to]);

  return profileTypes;
}
