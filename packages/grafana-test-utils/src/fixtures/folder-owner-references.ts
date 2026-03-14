import { wellFormedTree } from './folders';
import { MOCK_TEAMS } from './teams';

const [, { folderA }] = wellFormedTree();

/**
 * Maps folder UIDs to the team UIDs that own them.
 * Used by both folder and search mock handlers to keep ownership data consistent.
 */
export const FOLDER_TEAM_OWNERS: Record<string, string[]> = {
  [folderA.item.uid]: [MOCK_TEAMS[0].metadata.name],
};

/**
 * Returns all folder UIDs owned by the given team UID.
 */
export function getFolderUidsForTeam(teamUid: string): string[] {
  return Object.entries(FOLDER_TEAM_OWNERS)
    .filter(([, teamOwners]) => teamOwners.includes(teamUid))
    .map(([uid]) => uid);
}
