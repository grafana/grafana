import React from 'react';

import { Button, HorizontalGroup } from '@grafana/ui';

type Props = {
  title: string;
  onDismiss: () => void;
};

export const QueryEditorDrawerHeader = ({ title, onDismiss }: Props) => {
  //@TODO add buttons
  return (
    <HorizontalGroup justify={'space-between'}>
      <h1>{title}</h1>
      <HorizontalGroup>
        <Button icon="times" size="sm" variant={'secondary'} onClick={onDismiss}>
          Close
        </Button>
        <Button icon="share-alt" size="sm" variant={'secondary'} />
        <Button icon="upload" size="sm" variant={'secondary'} />
        <Button size="sm" variant={'secondary'}>
          Save
        </Button>
        <Button icon="trash-alt" size="sm" variant={'destructive'} />
      </HorizontalGroup>
    </HorizontalGroup>
  );
};
