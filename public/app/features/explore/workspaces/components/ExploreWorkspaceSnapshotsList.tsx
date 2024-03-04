import React from 'react';

import { Button, Card } from '@grafana/ui';

import { ExploreWorkspaceSnapshot } from '../types';

type Props = {
  snapshots: ExploreWorkspaceSnapshot[] | undefined;
  selected: (workspace: ExploreWorkspaceSnapshot) => void;
};

export const ExploreWorkspaceSnapshotsList = (props: Props) => {
  if (!props.snapshots) {
    return <div>Loading snapshots...</div>;
  }

  return (
    <div>
      {props.snapshots.map((snapshot, index) => (
        <Card key={index}>
          <Card.Heading>{snapshot.name}</Card.Heading>
          <Card.Description>{snapshot.description}</Card.Description>
          <Card.Meta>
            <span>
              Created: {new Date(snapshot.created).toLocaleString()} (by {snapshot.user.Login})
            </span>
            <span>
              Updated: {new Date(snapshot.updated).toLocaleString()} (by {snapshot.user.Login})
            </span>
          </Card.Meta>
          <Card.Actions>
            <Button onClick={() => props.selected(snapshot)}>load</Button>
          </Card.Actions>
        </Card>
      ))}
    </div>
  );
};
