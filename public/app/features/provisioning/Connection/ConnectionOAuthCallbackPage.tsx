import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { Alert, LoadingPlaceholder, TextLink } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';

import { CONNECTIONS_TAB_URL, CONNECTIONS_URL } from '../constants';
import { completeOAuthAuthorization, failOAuthAuthorization } from '../utils/connectionOAuth';

export default function ConnectionOAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const providerError = searchParams.get('error_description') || searchParams.get('error');

    if (providerError) {
      const pending = state ? failOAuthAuthorization(state, providerError) : undefined;
      setError(providerError);
      if (pending?.popup) {
        window.close();
      }
      return;
    }
    if (!code || !state) {
      setError(t('provisioning.oauth-callback.error-missing-params', 'Missing authorization code'));
      return;
    }

    completeOAuthAuthorization(code, state)
      .then(({ name, popup, error }) => {
        if (popup) {
          if (error) {
            setError(error);
          } else {
            setDone(true);
          }
          window.close();
          return;
        }
        if (error) {
          setError(error);
          return;
        }
        navigate(`${CONNECTIONS_URL}/${name}/edit`);
      })
      .catch((err) => {
        setError(
          extractErrorMessage(err) ||
            t('provisioning.oauth-callback.error-authorize', 'Failed to complete authorization')
        );
      });
  }, [searchParams, navigate]);

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: t('provisioning.oauth-callback.page-title', 'Completing authorization') }}
    >
      <Page.Contents>
        {error ? (
          <Alert severity="error" title={t('provisioning.oauth-callback.error-title', 'Authorization failed')}>
            {error}
            <div>
              <TextLink href={CONNECTIONS_TAB_URL}>
                <Trans i18nKey="provisioning.oauth-callback.back-to-connections">Back to connections</Trans>
              </TextLink>
            </div>
          </Alert>
        ) : done ? (
          <Alert severity="success" title={t('provisioning.oauth-callback.done-title', 'Authorization complete')}>
            <Trans i18nKey="provisioning.oauth-callback.done-message">You can close this tab.</Trans>
          </Alert>
        ) : (
          <LoadingPlaceholder text={t('provisioning.oauth-callback.loading', 'Completing authorization...')} />
        )}
      </Page.Contents>
    </Page>
  );
}
