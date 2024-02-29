import * as api from './api';

export const useExploreWorkspaces = () => {
  const getExploreWorkspace = async (uid: string) => {
    await api.getExploreWorkspace(uid);
  };

  return {
    getExploreWorkspace,
  };
};
