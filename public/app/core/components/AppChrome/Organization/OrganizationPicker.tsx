import React from 'react';

import { ValuePicker } from '@grafana/ui';
import { UserOrg } from 'app/types';

import { OrganizationBaseProps } from './types';

export function OrganizationPicker({ orgs, onSelectChange }: OrganizationBaseProps) {
  return (
    <ValuePicker<UserOrg>
      aria-label="Change organization"
      variant="secondary"
      size="md"
      label=""
      fill="text"
      isFullWidth={false}
      options={orgs.map((org) => ({
        label: org.name,
        description: org.role,
        value: org,
      }))}
      onChange={onSelectChange}
      icon="building"
    />
  );
}
