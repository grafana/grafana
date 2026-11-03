import { type UserView } from '@grafana/ui';

export const whoamiURL = 'apis/iam.grafana.app/v0alpha1/whoami';
export const bootdataURL = 'bootdata';

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
  let response: Response | undefined;
  try {
    response = await fetch(whoamiURL);
  } catch {
    // Handled with a rejected request
  }
  if (!response?.ok) {
    console.warn('No identity found, falling back to the boot data');
    return loadBootData();
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

interface BootData {
  user?: { isSignedIn?: boolean; name?: string; login?: string; email?: string; gravatarUrl?: string };
  settings?: { namespace?: string };
}

// The boot data has the namespace and the signed in user, as the app itself gets them
async function loadBootData(): Promise<WhoAmI> {
  try {
    const response = await fetch(bootdataURL);
    if (response.ok) {
      const data: BootData = await response.json();
      const namespace = data.settings?.namespace;
      const user = data.user;
      if (!user?.isSignedIn) {
        return { namespace };
      }
      return {
        namespace,
        userView: {
          user: { name: user.name || user.email || user.login || '', avatarUrl: user.gravatarUrl },
          lastActiveAt: new Date(),
        },
      };
    }
  } catch {
    // Nothing more to try
  }
  return {};
}
