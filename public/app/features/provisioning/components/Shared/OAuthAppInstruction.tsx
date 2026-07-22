import { Trans } from '@grafana/i18n';
import { Text, TextLink } from '@grafana/ui';

import { type OAuthConnectionType } from '../../types';
import { getOAuthCallbackUri } from '../../utils/connectionOAuth';

const docsUrls: Record<OAuthConnectionType, string> = {
  gitlab: 'https://docs.gitlab.com/integration/oauth_provider/',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/',
};

export function OAuthAppInstruction({ type }: { type: OAuthConnectionType }) {
  const callbackUri = getOAuthCallbackUri();

  return (
    <div>
      <Text weight="bold" element="h6">
        <Trans i18nKey="provisioning.oauth-app.help-title">Need help creating an OAuth app?</Trans>
      </Text>

      <Text element="p" color="secondary">
        {type === 'gitlab' ? (
          <Trans i18nKey="provisioning.oauth-app.help-instructions-gitlab">
            In GitLab, go to your user or group settings and create an application with the <code>api</code> scope and
            the callback URL below, then paste its application ID and secret here.{' '}
            <TextLink external href={docsUrls.gitlab}>
              View step-by-step instructions
            </TextLink>
          </Trans>
        ) : (
          <Trans i18nKey="provisioning.oauth-app.help-instructions-bitbucket">
            In Bitbucket, go to your workspace settings and add an OAuth consumer with repository write, pull request,
            and webhook permissions and the callback URL below, then paste its key and secret here.{' '}
            <TextLink external href={docsUrls.bitbucket}>
              View step-by-step instructions
            </TextLink>
          </Trans>
        )}
      </Text>

      <Text element="p" color="secondary">
        <Trans i18nKey="provisioning.oauth-app.callback-url">Callback URL:</Trans> <code>{callbackUri}</code>
      </Text>
    </div>
  );
}
