import { randomBytes } from 'crypto';

import { type Team } from 'app/types/teams';

function generateShortUid(): string {
  return randomBytes(3).toString('hex'); // Generate a short UID
}

export const getMockTeam = (i = 1, uid = 'aaaaaa', overrides = {}): Team => {
  uid = uid || generateShortUid();
  return {
    id: i,
    uid: uid,
    name: `test-${uid}`,
    avatarUrl: 'some/url/',
    email: `test-${uid}@test.com`,
    memberCount: i,
    accessControl: { isEditor: false },
    orgId: 0,
    isProvisioned: false,
    ...overrides,
  };
};
