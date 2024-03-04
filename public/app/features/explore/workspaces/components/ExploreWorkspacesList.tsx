import React from 'react';

import { Alert, Button, Card } from '@grafana/ui';

import { ExploreWorkspace } from '../types';

type Props = {
  current?: string;
  workspaces: ExploreWorkspace[] | undefined;
  selected: (ExploreWorkspace: ExploreWorkspace) => void;
};

export const ExploreWorkspacesList = (props: Props) => {
  if (!props.workspaces) {
    return <div>Loading workspaces...</div>;
  }

  if (props.workspaces.length === 0) {
    return <Alert severity="info" title="No workspaces"></Alert>;
  }

  return (
    <div>
      {props.workspaces.map((workspace, index) => (
        <Card key={index} isSelected={workspace.uid === props.current}>
          <Card.Heading>{workspace.name}</Card.Heading>
          <Card.Description>{workspace.description}</Card.Description>
          {workspace.activeSnapshot && (
            <Card.Meta>
              <span>
                Created: {new Date(workspace.activeSnapshot.created).toLocaleString()} (by {workspace.user.Login})
              </span>
              <span>
                Updated: {new Date(workspace.activeSnapshot.updated).toLocaleString()} (by{' '}
                {workspace.activeSnapshot.user.Login})
              </span>
            </Card.Meta>
          )}
          <Card.Actions>
            <Button icon="sync" onClick={() => props.selected(workspace)}>
              switch
            </Button>
            <Button variant="destructive" onClick={() => props.selected(workspace)}>
              delete
            </Button>
          </Card.Actions>
        </Card>
      ))}
    </div>
  );
};
