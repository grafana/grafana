import React, { useEffect } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Organization } from 'app/types';
import { SelectableValue } from '@grafana/data';
import { useAsyncFn } from 'react-use';

export type OrgSelectItem = SelectableValue<Organization>;

export interface Props {
  onSelected: (org: OrgSelectItem) => void;
  className?: string;
  inputId?: string;
  autoFocus?: boolean;
}

export function OrgPicker({ onSelected, className, inputId, autoFocus }: Props) {
  // For whatever reason the autoFocus prop doesn't seem to work
  // with AsyncSelect, hence this workaround. Maybe fixed in a later version?
  useEffect(() => {
    if (autoFocus && inputId) {
      document.getElementById(inputId)?.focus();
    }
  }, [autoFocus, inputId]);

  const [orgOptionsState, getOrgOptions] = useAsyncFn(async () => {
    const orgs: Organization[] = await getBackendSrv().get('/api/orgs');
    return orgs.map((org) => ({ value: { id: org.id, name: org.name }, label: org.name }));
  });

  return (
    <AsyncSelect
      menuShouldPortal
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
