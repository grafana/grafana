import React from 'react';

import { DataQuery } from '@grafana/data/src';
import { Button, HorizontalGroup } from '@grafana/ui';

import { SavedQuery } from '../api/SavedQueriesApi';
import { getSavedQuerySrv } from '../api/SavedQueriesSrv';

type Props = {
  savedQuery: SavedQuery<DataQuery>;
  onDismiss: () => void;
};

export const QueryEditorDrawerHeader = ({ savedQuery, onDismiss }: Props) => {
  //@TODO add buttons actions

  // @TODO currently fails as it's loading a hardcoded query, revisit
  const deleteQuery = async () => {
    await getSavedQuerySrv().deleteSavedQuery({ uid: 'system/queries/ds-variables.json' });
    onDismiss();
  };

  return (
    <HorizontalGroup justify={'space-between'}>
      <h1>{savedQuery.title}</h1>
      <HorizontalGroup>
        <Button icon="times" size="sm" variant={'secondary'} onClick={onDismiss}>
          Close
        </Button>
        <Button icon="share-alt" size="sm" variant={'secondary'} />
        <Button icon="upload" size="sm" variant={'secondary'} />
        <Button size="sm" variant={'secondary'}>
          Save
        </Button>
        <Button icon="trash-alt" size="sm" variant={'destructive'} onClick={deleteQuery} />
      </HorizontalGroup>
    </HorizontalGroup>
  );
};
