import React, { ChangeEvent, useState } from 'react';

import { NavModel, SelectableValue } from '@grafana/data';
import { Field, Input, Label, Box, Select } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardModel } from '../state';

export type Props = {
  dashboard: DashboardModel;
  sectionNav: NavModel;
};

export function EntitySettings({ dashboard, sectionNav }: Props): JSX.Element {
  const pageNav = sectionNav.node.parentItem;

  const [entityType, setEntityType] = useState(dashboard.entityType);
  const onEntityTypeChange = (value: SelectableValue) => {
    dashboard.entityType = value.value;
    setEntityType(value.value);
  };

  const [entityIdRegex, setEntityIdRegex] = useState(dashboard.entityIdRegex);
  const onEntityIdRegexChange = (value: string) => {
    dashboard.entityIdRegex = value;
    setEntityIdRegex(value);
  };
  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      <div style={{ maxWidth: '600px' }}>
        <Box marginBottom={5}>
          <Field label={<Label>Entity type</Label>}>
            <Select
              value={entityType}
              placeholder={'Select entity type'}
              width={200}
              options={[
                { label: 'Namespace', value: 'namespace' },
                { label: 'Service', value: 'service' },
                { label: 'Container', value: 'container' },
              ]}
              onChange={onEntityTypeChange}
            />
          </Field>
          <Field label={<Label>Entity id matcher</Label>}>
            <Input
              name="entityIdMatcher"
              value={entityIdRegex}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onEntityIdRegexChange(e.target.value)}
            />
          </Field>
        </Box>
      </div>
    </Page>
  );
}
