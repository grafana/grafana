import React from 'react';

import { HorizontalGroup } from '@grafana/ui';

type Props = {
  title: string;
};

export const QueryEditorDrawerHeader = ({ title }: Props) => {
  //@TODO add buttons
  return (
    <HorizontalGroup>
      <h1>{title}</h1>
    </HorizontalGroup>
  );
};
