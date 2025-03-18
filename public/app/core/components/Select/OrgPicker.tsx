import { useEffect, useState } from 'react';
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
  defaultOrganization?: Organization;
}

function orgToSelectItem(org: Organization): OrgSelectItem {
  return {
    value: org,
    label: org.name,
  };
}

export function OrgPicker({ onSelected, className, inputId, autoFocus, excludeOrgs, defaultOrganization }: Props) {
  const [selected, setSelected] = useState<OrgSelectItem | undefined>(
    defaultOrganization ? orgToSelectItem(defaultOrganization) : undefined
  );
  // For whatever reason the autoFocus prop doesn't seem to work
  // with AsyncSelect, hence this workaround. Maybe fixed in a later version?
  useEffect(() => {
    if (autoFocus && inputId) {
      document.getElementById(inputId)?.focus();
    }
  }, [autoFocus, inputId]);

  const [orgOptionsState, getOrgOptions] = useAsyncFn(async () => {
    const orgs: Organization[] = await getBackendSrv().get('/api/orgs');
    const allOrgs = orgs.map(orgToSelectItem);
    if (excludeOrgs) {
      let idArray = excludeOrgs.map((anOrg) => anOrg.orgId);
      return allOrgs.filter((item) => {
        return item.value !== undefined && !idArray.includes(item.value.id);
      });
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
      loadOptions={getOrgOptions}
      filterOption={(option, rawInput) => {
        const input = rawInput.toLowerCase();
        return !!option.value?.name.toLowerCase().includes(input);
      }}
      onChange={(item) => {
        onSelected(item);
        setSelected(item);
      }}
      value={selected}
      placeholder="Select organization"
      noOptionsMessage="No organizations found"
    />
  );
}
