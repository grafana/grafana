import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { useEffect, useRef } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';

import { type LoginDTO } from './types';

interface BeginResponse {
  sessionID: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}

interface FinishRequest {
  sessionID: string;
  response: AuthenticationResponseJSON;
}

const BEGIN_URL = '/api/auth/passkey/login/begin';
const FINISH_URL = '/api/auth/passkey/login/finish';

interface RunPasskeyLoginOptions {
  // useBrowserAutofill runs the discoverable login as a Conditional UI ceremony (the browser surfaces
  // the passkey in the username field's autofill) instead of a modal dialog. The library cancels any
  // previously started ceremony via its internal WebAuthnAbortService, so an autofill ceremony and a
  // button-initiated modal ceremony never collide.
  useBrowserAutofill?: boolean;
}

// runPasskeyLogin drives one full discoverable-login ceremony: begin -> authenticator -> finish. It is
// the single shared code path for both the explicit button (modal) and the autofill hook (conditional)
// so the request handling lives in exactly one place.
export async function runPasskeyLogin({ useBrowserAutofill }: RunPasskeyLoginOptions = {}): Promise<LoginDTO> {
  const begin = await getBackendSrv().post<BeginResponse>(BEGIN_URL, undefined, {
    showErrorAlert: false,
  });

  const assertion = await startAuthentication({ optionsJSON: begin.options, useBrowserAutofill });

  const finishBody: FinishRequest = { sessionID: begin.sessionID, response: assertion };
  return getBackendSrv().post<LoginDTO>(FINISH_URL, finishBody, {
    showErrorAlert: false,
  });
}

export function redirectAfterPasskeyLogin(result: LoginDTO): void {
  if (result.redirectUrl) {
    if (config.appSubUrl !== '' && !result.redirectUrl.startsWith(config.appSubUrl)) {
      window.location.assign(config.appSubUrl + result.redirectUrl);
    } else {
      window.location.assign(result.redirectUrl);
    }
  } else {
    window.location.assign(config.appSubUrl + '/');
  }
}

// isWebAuthnAbort is true when the user dismissed the OS prompt, no credential was available, or the
// browser timed out the ceremony. These are not real errors — the caller stays silent.
export function isWebAuthnAbort(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}

// usePasskeyAutofill starts a Conditional UI ceremony on mount so an enrolled passkey is offered in the
// username field's autofill. It is deliberately silent: if passkeys are disabled, the browser lacks
// Conditional UI support, the user has no passkey, or no annotated input is present, nothing happens and
// password login is unaffected. On a resolved assertion it completes login and redirects.
export function usePasskeyAutofill(): void {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    if (!config.passkey?.enabled || typeof window === 'undefined' || !('PublicKeyCredential' in window)) {
      return;
    }

    (async () => {
      try {
        if (!(await browserSupportsWebAuthnAutofill())) {
          return;
        }

        const result = await runPasskeyLogin({ useBrowserAutofill: true });

        // A late resolve after the login page unmounted should do nothing.
        if (mounted.current) {
          redirectAfterPasskeyLogin(result);
        }
      } catch (_err) {
        // No passkey, user ignored autofill, ceremony aborted, or no annotated input present — all
        // expected for the conditional path. Stay silent; the user proceeds with password login.
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, []);
}
