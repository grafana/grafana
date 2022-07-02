import React from 'react';

import { Icon } from '@grafana/ui';

import { ResourceRow, ResourceRowType } from './types';

interface EntryIconProps {
  entry: ResourceRow;
  isOpen: boolean;
}

export const EntryIcon: React.FC<EntryIconProps> = ({ isOpen, entry: { type } }) => {
  switch (type) {
    case ResourceRowType.Subscription:
      return <Icon name="layer-group" />;

    case ResourceRowType.ResourceGroup:
      return <Icon name={isOpen ? 'folder-open' : 'folder'} />;

    case ResourceRowType.Resource:
      return <Icon name="cube" />;

    case ResourceRowType.VariableGroup:
      return <Icon name="x" />;

    case ResourceRowType.Variable:
      return <Icon name="x" />;

    default:
      return null;
  }
};
