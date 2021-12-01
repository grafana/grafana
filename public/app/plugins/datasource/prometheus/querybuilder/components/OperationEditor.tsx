import { InlineLabel } from '@grafana/ui';
import React from 'react';
import { PromVisualQueryOperation } from '../types';

export interface Props {
  operation: PromVisualQueryOperation;
  index: number;
  onChange: (index: number, update: PromVisualQueryOperation) => void;
}

export function OperationEditor({ operation }: Props) {
  return <InlineLabel width="auto">{operation.type}()</InlineLabel>;
}
