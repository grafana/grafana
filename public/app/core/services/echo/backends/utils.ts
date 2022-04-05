import { CurrentUserDTO } from '@grafana/data';

/**
 * Returns an opaque identifier for a user, for reporting purposes.
 * Because this is for use when reporting across multiple Grafana installations
 * It cannot simply by user.id
 */
export function getUserIdentifier(user: CurrentUserDTO) {
  if (user.externalUserId.length) {
    return user.externalUserId;
  }

  return user.email;
}
