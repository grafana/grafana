import { type CurrentUserDTO, OrgRole } from '@grafana/data';

import { config } from '../../../config';
import { setAPIDiscoveryForTesting } from '../../apiDiscovery/discovery';

/** Makes discovery report the app plugin API of each plugin as served in `v0alpha1`. */
export function serveAppPluginAPIs(...pluginIds: string[]): void {
  setAPIDiscoveryForTesting(
    pluginIds.map((group) => ({ group, versions: ['v0alpha1'], preferredVersion: 'v0alpha1' }))
  );
}

/** Without a session, discovery answers unknown without a request. Restore with the returned handle. */
export function signInViewer(): jest.ReplaceProperty<CurrentUserDTO> {
  return jest.replaceProperty(config.bootData, 'user', {
    ...config.bootData.user,
    isSignedIn: true,
    orgRole: OrgRole.Viewer,
  });
}

/** `GET /apis` or `GET /apis/<group>/`. */
export function isAPIDiscoveryRequest(url: string): boolean {
  return /^\/apis(\/[^/]+\/)?$/.test(url);
}
