import { useMemo } from 'react';

import { type IconName } from '@grafana/data';
import { useGetTeamFolders } from 'app/core/components/NestedFolderPicker/useTeamOwnedFolder';

/** Same icon Grafana uses for teams. */
export const TEAM_FOLDER_ICON: IconName = 'users-alt';

export interface TeamFolderNode {
  uid: string;
  title: string;
  parentUid: string;
  /** Names of the user's teams that own this folder. */
  teams: string[];
}

/** Folders owned by teams the user is in, one row per folder. */
export function useTeamFolders() {
  const { foldersByTeam, isLoading, error } = useGetTeamFolders();

  const folders = useMemo(() => {
    const byUid = new Map<string, TeamFolderNode>();
    for (const { team, folders } of foldersByTeam) {
      for (const folder of folders) {
        const existing = byUid.get(folder.name);
        if (existing) {
          existing.teams.push(team.name);
        } else {
          byUid.set(folder.name, {
            uid: folder.name,
            title: folder.title,
            parentUid: folder.folder ?? '',
            teams: [team.name],
          });
        }
      }
    }
    const collator = new Intl.Collator();
    return [...byUid.values()].sort((a, b) => collator.compare(a.title, b.title));
  }, [foldersByTeam]);

  return { folders, isLoading, error };
}
