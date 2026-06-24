import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { useEffect, useRef, useState } from 'react';

import { store } from '@grafana/data';
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

// PASSKEY_HINT_KEY flags that this browser has been used to sign in with (or register) a passkey. It
// is a per-origin localStorage hint, not a security signal — it only drives the login button's label
// (primary vs "another device") since a relying party cannot enumerate the user's local credentials.
export const PASSKEY_HINT_KEY = 'grafana.passkeyUsed';

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

// PasskeyButtonMode is the resolved visibility/label state of the explicit passkey button:
//   checking   — capability detection has not finished yet (render nothing).
//   hidden      — passkeys are off, the browser supports autofill (Conditional UI covers it), or the
//                 device has no platform authenticator. The button must not render.
//   primary     — show "Sign in with a passkey" (a passkey was used on this browser before).
//   secondary   — show "Use a passkey from another device" (capable browser, no prior passkey).
export type PasskeyButtonMode = 'checking' | 'hidden' | 'primary' | 'secondary';

// usePasskeyButtonMode is the single source of truth for whether the explicit passkey button renders
// and with which label. Both the button and the surrounding LoginServiceButtons layout consume it: the
// layout needs to know the button's runtime visibility so it does not draw the "or" divider above a
// button that hides itself.
export function usePasskeyButtonMode(): PasskeyButtonMode {
  const [mode, setMode] = useState<PasskeyButtonMode>('checking');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!config.passkey?.enabled || typeof window === 'undefined' || !('PublicKeyCredential' in window)) {
        setMode('hidden');
        return;
      }

      // When the browser supports Conditional UI, the username field's autofill already offers the
      // passkey (including "from another device"), so the explicit button would be a redundant second
      // prompt. Hide it and let autofill be the single entry point.
      if (await browserSupportsWebAuthnAutofill()) {
        if (!cancelled) {
          setMode('hidden');
        }
        return;
      }

      // No autofill (e.g. Firefox): the button is the only entry point, so show it. We deliberately do
      // NOT gate on a platform authenticator — the "another device" label is exactly the flow for a
      // device without one (cross-device via the user's phone, or a roaming security key). The label,
      // driven by the per-browser hint, sets the right expectation:
      //   hint present -> the user has used a passkey here before -> "Sign in with a passkey".
      //   no hint      -> "Use a passkey from another device".
      if (cancelled) {
        return;
      }
      setMode(store.getBool(PASSKEY_HINT_KEY, false) ? 'primary' : 'secondary');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return mode;
}
