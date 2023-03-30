import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  defaultDatabase: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ defaultDatabase, onChange }: DatasetSelectorProps) => (
  <Select
    aria-label="Dataset selector"
    value={toOption(defaultDatabase)}
    disabled={true}
    onChange={onChange}
    menuShouldPortal={true}
    placeholder={defaultDatabase}
  />
);
