import React from 'react';

import { Button, Card } from '@grafana/ui';

import { ExploreWorkspace } from '../types';

type Props = {
  workspaces: ExploreWorkspace[] | undefined;
  selected: (ExploreWorkspace: ExploreWorkspace) => void;
};

export const ExploreWorkspacesList = (props: Props) => {
  if (!props.workspaces) {
    return <div>Loading workspaces...</div>;
  }

  return (
    <div>
      {props.workspaces.map((workspace, index) => (
        <Card key={index}>
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
            <Button onClick={() => props.selected(workspace)}>load</Button>
          </Card.Actions>
        </Card>
      ))}
    </div>
  );
};
