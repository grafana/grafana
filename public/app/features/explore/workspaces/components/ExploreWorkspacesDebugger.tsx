import React from 'react';

import { Button } from '@grafana/ui';

import { ExploreDrawer } from '../../ExploreDrawer';
import { ExploreWorkspace } from '../types';
import { useExploreWorkspaces } from '../utils/hooks';

type Props = {
  width: number;
};

export const ExploreWorkspacesDebugger = (props: Props) => {
  const { getExploreWorkspace, createExploreWorkspace, updateExploreWorkspaceLatestSnapshot, workspaces } =
    useExploreWorkspaces();

  const [loadedWorkspace, setLoadedWorkspace] = React.useState<ExploreWorkspace | undefined>();

  return (
    <ExploreDrawer width={props.width}>
      <div>ExploreWorkspacesDebugger</div>
      <div>Currently loaded workspace: {loadedWorkspace?.name || 'none'}</div>
      <Button
        onClick={async () => {
          const response = await getExploreWorkspace(workspaces[workspaces.length - 1].uid);
          setLoadedWorkspace(response.exploreWorkspace);
        }}
      >
        Get Workspace
      </Button>
      <Button
        onClick={async () => {
          if (loadedWorkspace) {
            const updatedSnapshot = await updateExploreWorkspaceLatestSnapshot({
              exploreWorkspaceUID: loadedWorkspace.uid,
              config: JSON.stringify({ foo: 2 }),
            });
            loadedWorkspace.activeSnapshot = updatedSnapshot;
          }
        }}
      >
        Update
      </Button>
      <Button
        onClick={() =>
          createExploreWorkspace({
            name: 'Test Workspace',
            description: 'Test Workspace Description',
            config: JSON.stringify({ foo: 1 }),
          })
        }
      >
        Create Workspace
      </Button>
      <p>Workspaces: {workspaces.length}</p>
      {workspaces.map((workspace: ExploreWorkspace, index) => (
        <pre key={index}>{JSON.stringify(workspace)}</pre>
      ))}
    </ExploreDrawer>
  );
};
