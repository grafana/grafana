import React, { useEffect, useState } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { Organization } from 'app/types';
import { SelectableValue } from '@grafana/data';

export type OrgSelectItem = SelectableValue<Organization>;

export interface Props {
  onSelected: (org: OrgSelectItem) => void;
  className?: string;
  inputId?: string;
  autoFocus?: boolean;
}

export function OrgPicker(props: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // For whatever reason the autoFocus prop doesn't seem to work
  // with AsyncSelect, hence this workaround. Maybe fixed in a later version?
  useEffect(() => {
    if (props.autoFocus && props.inputId) {
      document.getElementById(props.inputId)?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrgs = async () => {
    setIsLoading(true);
    const orgs = await getBackendSrv().get('/api/orgs');
    setOrgs(orgs);
    setIsLoading(false);
    return orgs;
  };

  const getOrgOptions = async (query: string): Promise<OrgSelectItem[]> => {
    if (!orgs?.length) {
      await loadOrgs();
    }
    return orgs.map(
      (org: Organization): OrgSelectItem => ({
        value: { id: org.id, name: org.name },
        label: org.name,
      })
    );
  };

  const { className, onSelected, inputId } = props;

  return (
    <AsyncSelect
      menuShouldPortal
      inputId={inputId}
      className={className}
      isLoading={isLoading}
      defaultOptions={true}
      isSearchable={false}
      loadOptions={getOrgOptions}
      onChange={onSelected}
      placeholder="Select organization"
      noOptionsMessage="No organizations found"
    />
  );
}
