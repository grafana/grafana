import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
import { Organization, UserOrg } from 'app/types';

export type OrgSelectItem = SelectableValue<Organization>;

export interface Props {
  onSelected: (org: OrgSelectItem) => void;
  className?: string;
  inputId?: string;
  autoFocus?: boolean;
  excludeOrgs?: UserOrg[];
}

export function OrgPicker({ onSelected, className, inputId, autoFocus, excludeOrgs }: Props) {
  // For whatever reason the autoFocus prop doesn't seem to work
  // with AsyncSelect, hence this workaround. Maybe fixed in a later version?
  useEffect(() => {
    if (autoFocus && inputId) {
      document.getElementById(inputId)?.focus();
    }
  }, [autoFocus, inputId]);

  const [orgOptionsState, getOrgOptions] = useAsyncFn(async () => {
    const orgs: Organization[] = await getBackendSrv().get('/api/orgs');
    const allOrgs = orgs.map((org) => ({ value: { id: org.id, name: org.name }, label: org.name }));
    if (excludeOrgs) {
      let idArray = excludeOrgs.map((anOrg) => anOrg.orgId);
      const filteredOrgs = allOrgs.filter((item) => {
        return !idArray.includes(item.value.id);
      });
      return filteredOrgs;
    } else {
      return allOrgs;
    }
  });

  return (
    <AsyncSelect
      inputId={inputId}
      className={className}
      isLoading={orgOptionsState.loading}
      defaultOptions={true}
      isSearchable={false}
      loadOptions={getOrgOptions}
      onChange={onSelected}
      placeholder="Select organization"
      noOptionsMessage="No organizations found"
    />
  );
}
