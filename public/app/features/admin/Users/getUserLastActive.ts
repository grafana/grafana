import { t } from '@grafana/i18n';
import { type UserDTO } from 'app/types/user';

export function getUserLastActive(user: Pick<UserDTO, 'lastSeenAt' | 'created' | 'lastSeenAtAge'>): {
  text: string;
  neverLoggedIn: boolean;
} {
  if (!user.lastSeenAtAge) {
    return { text: '', neverLoggedIn: false };
  }

  // A last-seen timestamp before account creation indicates the user has never logged in.
  const neverLoggedIn = Boolean(user.lastSeenAt && user.created && new Date(user.lastSeenAt) < new Date(user.created));
  return {
    text: neverLoggedIn ? t('admin.users-table.last-seen-never', 'Never') : user.lastSeenAtAge,
    neverLoggedIn,
  };
}
