import { useState } from 'react';

import { store } from '@grafana/data';

export const LAST_USED_LOGIN_METHOD_KEY = 'grafana.login.lastUsedMethod';

export const PASSWORD_LOGIN_METHOD = 'password';

export function recordLastUsedLoginMethod(method: string) {
  store.set(LAST_USED_LOGIN_METHOD_KEY, method);
}

export function useLastUsedLoginMethod(): string | null {
  const [lastUsed] = useState<string | null>(() => store.get(LAST_USED_LOGIN_METHOD_KEY) ?? null);
  return lastUsed;
}
