import { useEffect, useState } from 'react';

import { ExploreWorkspace } from '../types';

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

  const createExploreWorkspace = async (name: string) => {
    const result = await api.createExploreWorkspace({
      name,
    });
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
