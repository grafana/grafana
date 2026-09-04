import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

// Not an image asset reference — this is the path the backend hands out (dtos.GetGravatarUrl)
// in place of gravatar URLs when gravatar is disabled.
// eslint-disable-next-line @grafana/no-restricted-img-srcs
const DEFAULT_PROFILE_IMAGE = '/public/img/user_profile.png';

/**
 * Builds the same avatar URL for a team that the legacy API returns, i.e. `/avatar/{sha256(email)}`.
 * Mirrors GetGravatarUrlWithDefault in pkg/api/dtos/models.go, including the fallback to a
 * pseudo-email derived from the team name when the team has no email set.
 */
export async function getTeamGravatarUrl(email: string, name: string): Promise<string | undefined> {
  // When gravatar is disabled the backend hands out this shared static image instead of per-hash
  // `/avatar/` URLs, which would each miss the avatar cache and log a warning. The signed-in
  // user's own gravatarUrl is built by the same backend function, so it tells us which branch
  // the server is on without needing the setting exposed to the frontend.
  if (contextSrv.user.gravatarUrl.endsWith(DEFAULT_PROFILE_IMAGE)) {
    return contextSrv.user.gravatarUrl;
  }

  const text = email !== '' ? email : name.replace(/[^a-zA-Z0-9]+/g, '') + '@localhost';
  const normalized = text.trim().toLowerCase();
  if (normalized === '') {
    return undefined;
  }

  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return `${config.appSubUrl ?? ''}/avatar/${hash}`;
  } catch {
    // crypto.subtle is unavailable in some environments (e.g. insecure contexts); skip the avatar.
    return undefined;
  }
}
