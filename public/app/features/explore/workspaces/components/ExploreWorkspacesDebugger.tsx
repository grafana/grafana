import React from 'react';

import { Button } from '@grafana/ui';

import { ExploreDrawer } from '../../ExploreDrawer';
import { ExploreWorkspace, ExploreWorkspaceSnapshot } from '../types';
import { useExploreWorkspaces } from '../utils/hooks';

type Props = {
  width: number;
};

export const ExploreWorkspacesDebugger = (props: Props) => {
  const {
    getExploreWorkspace,
    createExploreWorkspace,
    updateExploreWorkspaceLatestSnapshot,
    createExploreWorkspaceSnapshot,
    getExploreWorkspaceSnapshot,
    getExploreWorkspaceSnapshots,
    workspaces,
  } = useExploreWorkspaces();

  const [loadedWorkspace, setLoadedWorkspace] = React.useState<ExploreWorkspace | undefined>();
  const [loadedSnapshots, setLoadedSnapshots] = React.useState<ExploreWorkspaceSnapshot[] | undefined>();

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
            const response = await updateExploreWorkspaceLatestSnapshot({
              exploreWorkspaceUID: loadedWorkspace.uid,
              config: JSON.stringify({ foo: (loadedWorkspace.activeSnapshot?.version || 0) + 1 }),
            });
            loadedWorkspace.activeSnapshot = response.snapshot;
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

      <Button
        onClick={async () => {
          if (loadedWorkspace) {
            await createExploreWorkspaceSnapshot({
              name: 'Snapshot at v' + loadedWorkspace.activeSnapshot?.version || '',
              description: 'Desc at v' + loadedWorkspace.activeSnapshot?.version || '',
              exploreWorkspaceUID: loadedWorkspace.uid,
            });
          }
        }}
      >
        Take snapshot
      </Button>

      <Button
        onClick={async () => {
          if (loadedWorkspace) {
            const response = await getExploreWorkspaceSnapshots({
              exploreWorkspaceUid: loadedWorkspace?.uid,
            });
            setLoadedSnapshots(response.snapshots);
          }
        }}
      >
        Get snapshots
      </Button>
      <p>Snapshots loaded: {loadedSnapshots?.length}</p>

      <Button
        onClick={async () => {
          if (loadedSnapshots) {
            const snapshot = await getExploreWorkspaceSnapshot({
              uid: loadedSnapshots[loadedSnapshots.length - 2].uid,
            });

            console.log(snapshot);
          }
        }}
      >
        Get snapshot
      </Button>

      <p>Workspaces: {workspaces.length}</p>
      {workspaces.map((workspace: ExploreWorkspace, index) => (
        <pre key={index}>{JSON.stringify(workspace)}</pre>
      ))}
    </ExploreDrawer>
  );
};
