import { CurrentUserDTO } from '@grafana/data';
import { attachDebugger, createLogger } from '@grafana/ui';

/**
 * Returns an opaque identifier for a user, for reporting purposes.
 * Because this is for use when reporting across multiple Grafana installations
 * It cannot simply be user.id because that's not unique across two installations.
 */
export function getUserIdentifier(user: CurrentUserDTO) {
  if (user.externalUserId.length) {
    return user.externalUserId;
  }

  return user.email;
}

export function loadScript(url: string, async = false) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.src = url;
    script.async = async;
    document.head.appendChild(script);
  });
}

/** @internal */
export const echoLogger = createLogger('EchoSrv');
export const echoLog = echoLogger.logger;

attachDebugger('echo', undefined, echoLogger);
