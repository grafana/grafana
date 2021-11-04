import React from 'react';
import { Button } from '@grafana/ui';

export const MultiSelectionEditor = () => {
  const createNewLayer = () => {
    console.log('TODO: create new layer');
  };

  return (
    <div>
      <Button size="sm" variant="secondary" onClick={createNewLayer}>
        Create New Layer
      </Button>
    </div>
  );
};
