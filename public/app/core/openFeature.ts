import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';

import { config } from '@grafana/runtime';

import { contextSrv } from './core';

export async function initOpenFeature() {
  // OpenFeature currently requires authenticated user
  if (!contextSrv.user.isSignedIn) {
    return false;
  }

  const ofProvider = new OFREPWebProvider({
    baseUrl: '/apis/features.grafana.app/v0alpha1/namespaces/' + config.namespace,
    pollInterval: -1, // disable polling
    timeoutMs: 5_000,
  });

  await OpenFeature.setProviderAndWait(ofProvider, {
    targetingKey: config.namespace,
    namespace: config.namespace,
  });

  return true;
}
