import { config } from '@grafana/runtime';

/**
 * Builds the same avatar URL for a team that the legacy API returns, i.e. `/avatar/{sha256(email)}`.
 * Mirrors GetGravatarUrlWithDefault in pkg/api/dtos/models.go, including the fallback to a
 * pseudo-email derived from the team name when the team has no email set.
 */
export async function getTeamGravatarUrl(email: string, name: string): Promise<string | undefined> {
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
