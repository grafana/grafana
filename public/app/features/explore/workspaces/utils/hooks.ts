import { useEffect, useState } from 'react';

import {
  CreateExploreWorkspaceCommand,
  CreateExploreWorkspaceSnapshotCommand,
  ExploreWorkspace,
  GetExploreWorkspaceSnapshotCommand,
  GetExploreWorkspaceSnapshotsCommand,
  UpdateExploreWorkspaceLatestSnapshotCommand,
} from '../types';

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

  const updateExploreWorkspaceLatestSnapshot = async (cmd: UpdateExploreWorkspaceLatestSnapshotCommand) => {
    const result = await api.updateExploreWorkspaceLatestSnapshot(cmd);
    await reload();
    return result;
  };

  const createExploreWorkspaceSnapshot = async (cmd: CreateExploreWorkspaceSnapshotCommand) => {
    return await api.createExploreWorkspaceSnapshot(cmd);
  };

  const getExploreWorkspaceSnapshot = async (cmd: GetExploreWorkspaceSnapshotCommand) => {
    return await api.getExploreWorkspaceSnapshot(cmd);
  };

  const getExploreWorkspaceSnapshots = async (cmd: GetExploreWorkspaceSnapshotsCommand) => {
    return await api.getExploreWorkspaceSnapshots(cmd);
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
    updateExploreWorkspaceLatestSnapshot,
    createExploreWorkspaceSnapshot,
    getExploreWorkspaceSnapshot,
    getExploreWorkspaceSnapshots,
    workspaces,
  };
};
