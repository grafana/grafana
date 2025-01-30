import { ComponentType } from 'react';

import { DataQuery } from '@grafana/schema';

export type QueryActionButtonProps = {
  queries: DataQuery[];
  datasourceUid?: string;
  onClick: () => void;
};

export type QueryActionButton = ComponentType<QueryActionButtonProps>;
