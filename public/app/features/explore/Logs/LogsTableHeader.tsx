import React from 'react';

import { Icon } from '@grafana/ui';
import { CustomHeaderRendererProps } from '@grafana/ui/src/components/Table/types';

interface Props extends CustomHeaderRendererProps {}
export const LogsTableHeader = (props: Props) => {
  return (
    <span style={{ display: 'flex' }}>
      {props.defaultContent}
      <span>
        <Icon name={'ellipsis-v'} />
      </span>
    </span>
  );
};
