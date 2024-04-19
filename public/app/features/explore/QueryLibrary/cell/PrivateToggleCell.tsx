import React from 'react';
import { CellProps } from 'react-table';

import { Switch } from '@grafana/ui/src/components/Switch/Switch';

import { QueryTemplateRow } from '../utils/view';

export function PrivateToggleCell(props: CellProps<QueryTemplateRow>) {
  return <Switch />;
}
