import React from 'react';

import { BaseCheckbox } from '../../Checkbox';

import { TableCheckboxProps } from './TableCheckbox.types';

export const TableCheckbox: React.FC<React.PropsWithChildren<TableCheckboxProps>> = ({ id, checked, onChange, title }) => (
  <BaseCheckbox
    name={`table-select-${id}`}
    title={title}
    value={String(checked)}
    checked={checked}
    onChange={onChange}
  />
);

TableCheckbox.displayName = 'TableCheckbox';
