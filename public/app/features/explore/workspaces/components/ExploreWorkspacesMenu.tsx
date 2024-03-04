import React, { useEffect, useState } from 'react';

import { Drawer, Tab, TabContent, TabsBar, ToolbarButton, ToolbarButtonRow } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { ExploreWorkspace, ExploreWorkspaceSnapshot } from '../types';
import { getExploreWorkspaceSnapshots } from '../utils/api';
import { useExploreWorkspaces } from '../utils/hooks';

import { ExploreWorkspaceSnapshotsList } from './ExploreWorkspaceSnapshotsList';
import { ExploreWorkspacesList } from './ExploreWorkspacesList';

type Props = {
  loadedWorkspace?: ExploreWorkspace;
  loadedSnapshot?: ExploreWorkspaceSnapshot;
  currentState?: Record<string, string | number | object>;
};

export const ExploreWorkspacesMenu = (props: Props) => {
  const { loadedWorkspace, loadedSnapshot, currentState } = props;

  const { workspaces, createExploreWorkspace, createExploreWorkspaceSnapshot } = useExploreWorkspaces();
  const { location } = useGrafana();

  const [isOpen, setIsOpen] = useState(false);
  const [loadedSnapshots, setLoadedSnapshots] = useState<ExploreWorkspaceSnapshot[] | undefined>(undefined);

  const showLatestHandler = () => {
    if (loadedWorkspace) {
      location.push('/explore/' + loadedWorkspace.uid);
      window.location.reload();
    }
  };

  const createExploreWorkspaceHandler = async () => {
    const workspace = await createExploreWorkspace({
      name: 'Test Workspace',
      description: 'Test Workspace Description',
      config: JSON.stringify(currentState),
    });
    location.push('/explore/' + workspace.uid);
    window.location.reload();
  };

  const takeSnapshotHandler = async () => {
    if (loadedWorkspace) {
      await createExploreWorkspaceSnapshot({
        name: 'Snapshot at v' + loadedWorkspace.activeSnapshot?.version || '',
        description: 'Desc at v' + loadedWorkspace.activeSnapshot?.version || '',
        exploreWorkspaceUID: loadedWorkspace.uid,
      });
    }
  };

  const loadWorkspacesAndSnapshotsHandler = async () => {
    setIsOpen(true);
    if (loadedWorkspace) {
      const snapshotsResponse = await getExploreWorkspaceSnapshots({
        exploreWorkspaceUid: loadedWorkspace.uid,
      });
      setLoadedSnapshots(snapshotsResponse.snapshots);
    }
  };

  const loadSnapshotHandler = async (snapshot: ExploreWorkspaceSnapshot) => {
    if (loadedWorkspace) {
      location.push('/explore/' + loadedWorkspace.uid + '/' + snapshot.uid);
      window.location.reload();
    }
  };

  if (!props.currentState) {
    return <>Loading...</>;
  }

  const CreateWorkspace = () => (
    <>
      <ToolbarButton variant={'primary'} icon="plus" onClick={createExploreWorkspaceHandler}>
        new workspace
      </ToolbarButton>
    </>
  );

  const ForkWorkspace = () => {
    return loadedWorkspace ? (
      <>
        <span>
          <em>
            {loadedWorkspace.name}
            {!loadedSnapshot ? ' (' + new Date(loadedWorkspace.activeSnapshot.updated).toLocaleString() + ')' : ''}
          </em>
        </span>
        {loadedSnapshot ? (
          <span>
            {' '}
            📷{' '}
            <em>
              {loadedSnapshot.name} ({new Date(loadedSnapshot.updated).toLocaleString()})
            </em>
          </span>
        ) : undefined}
        <ToolbarButton
          aria-label="fork"
          variant="default"
          icon="user-arrows"
          onClick={createExploreWorkspaceHandler}
        ></ToolbarButton>
      </>
    ) : undefined;
  };

  const ListWorkspacesAndSnapshots = () => {
    const [activeTab, setActiveTab] = useState('snapshots');

    useEffect(() => {
      if (!loadedSnapshots?.length) {
        setActiveTab('workspaces');
      } else {
        setActiveTab('snapshots');
      }
    }, []);

    return (
      <>
        <ToolbarButton
          aria-label="List snapshots & workspaces"
          icon="list-ul"
          onClick={() => loadWorkspacesAndSnapshotsHandler()}
        ></ToolbarButton>
        {isOpen && (
          <Drawer onClose={() => setIsOpen(false)}>
            <TabsBar>
              {loadedWorkspace && (
                <Tab
                  label="Snapshots"
                  counter={loadedSnapshots?.length}
                  onChangeTab={() => setActiveTab('snapshots')}
                />
              )}
              <Tab label="Workspaces" counter={workspaces.length} onChangeTab={() => setActiveTab('workspaces')} />
            </TabsBar>
            <TabContent>
              {activeTab === 'snapshots' && (
                <ExploreWorkspaceSnapshotsList
                  snapshots={loadedSnapshots}
                  selected={(snapshot) => loadSnapshotHandler(snapshot)}
                />
              )}
              {activeTab === 'workspaces' && (
                <ExploreWorkspacesList
                  workspaces={workspaces}
                  selected={(workspace) => {
                    location.push('/explore/' + workspace.uid);
                    window.location.reload();
                  }}
                />
              )}
            </TabContent>
          </Drawer>
        )}
      </>
    );
  };

  const ShowLatest = () => <ToolbarButton icon="sync" variant="default" onClick={showLatestHandler}></ToolbarButton>;
  const TakeSnapshot = () => (
    <ToolbarButton icon="capture" variant="primary" onClick={takeSnapshotHandler}></ToolbarButton>
  );

  return (
    <ToolbarButtonRow>
      {!loadedWorkspace ? <CreateWorkspace /> : undefined}
      {loadedWorkspace ? <ForkWorkspace /> : undefined}
      {loadedSnapshot ? <ShowLatest /> : undefined}
      {!loadedSnapshot && loadedWorkspace ? <TakeSnapshot /> : undefined}
      <ListWorkspacesAndSnapshots />
    </ToolbarButtonRow>
  );
};
