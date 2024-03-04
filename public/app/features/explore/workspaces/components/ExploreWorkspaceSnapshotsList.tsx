import React from 'react';

import { Alert, Button, Card } from '@grafana/ui';

import { ExploreWorkspaceSnapshot } from '../types';

type Props = {
  current?: string;
  snapshots: ExploreWorkspaceSnapshot[] | undefined;
  selected: (snapshot?: ExploreWorkspaceSnapshot) => void;
};

export const ExploreWorkspaceSnapshotsList = (props: Props) => {
  if (!props.snapshots) {
    return <div>Loading snapshots...</div>;
  }

  if (props.snapshots.length === 0) {
    return <Alert severity="info" title="No snapshots"></Alert>;
  }

  return (
    <div>
      <Card isSelected={!props.current}>
        <Card.Heading>Latest</Card.Heading>
        <Card.Description>Currently active</Card.Description>
        <Card.Actions>
          {props.current && (
            <Button icon="sync" onClick={() => props.selected(undefined)}>
              switch
            </Button>
          )}
        </Card.Actions>
      </Card>
      {props.snapshots.map((snapshot, index) => (
        <Card key={index} isSelected={snapshot.uid === props.current}>
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
            {snapshot.uid !== props.current && (
              <Button icon="sync" onClick={() => props.selected(snapshot)}>
                switch
              </Button>
            )}
            <Button variant="destructive" onClick={() => props.selected(snapshot)}>
              delete
            </Button>
          </Card.Actions>
        </Card>
      ))}
    </div>
  );
};
