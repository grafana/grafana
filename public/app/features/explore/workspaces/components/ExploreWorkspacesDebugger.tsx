import React from 'react';

import { Button } from '@grafana/ui';

import { ExploreDrawer } from '../../ExploreDrawer';
import { ExploreWorkspace } from '../types';
import { useExploreWorkspaces } from '../utils/hooks';

type Props = {
  width: number;
};

export const ExploreWorkspacesDebugger = (props: Props) => {
  const { getExploreWorkspace, createExploreWorkspace, workspaces } = useExploreWorkspaces();

  return (
    <ExploreDrawer width={props.width}>
      <div>ExploreWorkspacesDebugger</div>
      <Button onClick={() => getExploreWorkspace('test')}>Get Workspace</Button>
      <Button onClick={() => createExploreWorkspace('test name')}>Create Workspace</Button>
      <p>Workspaces: {workspaces.length}</p>
      {workspaces.map((workspace: ExploreWorkspace, index) => (
        <pre key={index}>{JSON.stringify(workspace)}</pre>
      ))}
    </ExploreDrawer>
  );
};
