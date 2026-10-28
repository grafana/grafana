import { type UserView } from '@grafana/ui';

export const whoamiURL = 'apis/iam.grafana.app/v0alpha1/whoami';

interface CurrentUserInfo {
  identity?: { type?: string; name?: string };
  displayName?: string;
  avatarURL?: string;
  email?: string;
  namespace?: string;
}

export interface WhoAmI {
  namespace?: string;
  // Unset for anonymous callers, so the page offers a login instead.
  userView?: UserView;
}

export async function loadWhoAmI(): Promise<WhoAmI> {
  const response = await fetch(whoamiURL);
  if (!response.ok) {
    console.warn('No identity found, show login button');
    return {};
  }

  const info: CurrentUserInfo = await response.json();
  if (info.identity?.type === 'anonymous') {
    return { namespace: info.namespace };
  }

  return {
    namespace: info.namespace,
    userView: {
      user: {
        name: info.displayName || info.email || info.identity?.name || '',
        avatarUrl: info.avatarURL,
      },
      lastActiveAt: new Date(),
    },
  };
}
