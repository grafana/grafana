import React from 'react';

import { SelectableValue } from '@grafana/data';
import { ValuePicker } from '@grafana/ui';
import { UserOrg } from 'app/types';

import { OrganizationBaseProps } from './types';

export function OrganizationPicker({ orgs, onSelectChange }: OrganizationBaseProps) {
  const onChange = (option: SelectableValue<UserOrg>) => {
    onSelectChange(option);
  };
  return (
    <ValuePicker<UserOrg>
      variant="secondary"
      size="sm"
      label=""
      fill="text"
      isFullWidth={false}
      options={orgs.map((org) => ({
        label: org.name,
        description: org.role,
        value: org,
      }))}
      onChange={onChange}
      icon="building"
    />
  );
}
