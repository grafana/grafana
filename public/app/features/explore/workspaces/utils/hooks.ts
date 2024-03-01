import { useEffect, useState } from 'react';

import { CreateExploreWorkspaceCommand, ExploreWorkspace } from '../types';

import * as api from './api';

export const useExploreWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<ExploreWorkspace[]>([]);

  const getExploreWorkspace = async (uid: string) => {
    return await api.getExploreWorkspace({
      exploreWorkspaceUID: uid,
    });
  };

  const getExploreWorkspaces = async () => {
    return await api.getExploreWorkspaces({});
  };

  const createExploreWorkspace = async (cmd: CreateExploreWorkspaceCommand) => {
    const result = await api.createExploreWorkspace(cmd);
    await reload();
    return result;
  };

  const reload = async () => {
    const exploreWorkspacesResponse = await getExploreWorkspaces();
    setWorkspaces(exploreWorkspacesResponse.exploreWorkspaces);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    getExploreWorkspace,
    getExploreWorkspaces,
    createExploreWorkspace,
    workspaces,
  };
};
