import React from 'react';

import { Button } from '@grafana/ui';

import { ExploreDrawer } from '../../ExploreDrawer';
import { useExploreWorkspaces } from '../utils/hooks';

type Props = {
  width: number;
};

export const ExploreWorkspacesDebugger = (props: Props) => {
  const { getExploreWorkspace } = useExploreWorkspaces();

  return (
    <ExploreDrawer width={props.width}>
      <div>ExploreWorkspacesDebugger</div>
      <Button onClick={() => getExploreWorkspace('test')}>Get Workspace</Button>
    </ExploreDrawer>
  );
};
