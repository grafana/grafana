import React from 'react';
import { CellProps } from 'react-table';

import { Button } from '@grafana/ui';

import { useDatasource } from '../utils/useDatasource';
import { QueryTemplateRow } from '../utils/view';

export function ActionsCell(props: CellProps<QueryTemplateRow>) {
  return (
    <span>
      <Button variant="primary">Run</Button>
    </span>
  );
}
