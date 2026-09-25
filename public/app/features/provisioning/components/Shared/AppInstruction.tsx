import { type ReactNode } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, ClipboardButton, Field, Input, Stack, Text, TextLink } from '@grafana/ui';

import { type ConnectionFormData, type OAuthConnectionType } from '../../types';
import { getOAuthCallbackUri, isOAuthConnectionType } from '../../utils/connectionOAuth';

export function AppInstruction({ type }: { type: ConnectionFormData['type'] }) {
  return isOAuthConnectionType(type) ? <OAuthAppInstruction type={type} /> : <GithubAppInstruction />;
}

const githubAppDocsUrl = 'https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app';

const GITLAB_SCOPE = 'api';

const docsUrls: Record<OAuthConnectionType, string> = {
  githubOAuth: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app',
  githubEnterpriseOAuth: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app',
  gitlabOAuth: 'https://docs.gitlab.com/integration/oauth_provider/',
  bitbucketOAuth: 'https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/',
};

function GithubAppInstruction() {
  return (
    <InstructionSection
      title={<Trans i18nKey="provisioning.wizard.github-app-help-title">Need help creating a GitHub App?</Trans>}
      description={
        <Trans i18nKey="provisioning.wizard.github-app-help-instructions">
          Create a GitHub App, generate a private key, install it, and paste the details below.{' '}
          <TextLink external href={githubAppDocsUrl}>
            View step-by-step instructions
          </TextLink>
        </Trans>
      }
    />
  );
}

function OAuthAppInstruction({ type }: { type: OAuthConnectionType }) {
  const callbackUri = getOAuthCallbackUri();

  return (
    <InstructionSection
      title={<Trans i18nKey="provisioning.oauth-app.help-title">Need help creating an OAuth app?</Trans>}
      description={
        type === 'githubOAuth' || type === 'githubEnterpriseOAuth' ? (
          <Trans i18nKey="provisioning.oauth-app.help-instructions-github">
            In GitHub, go to your developer settings and create an OAuth app with the callback URL below, then paste its
            client ID and a generated client secret here.{' '}
            <TextLink external href={docsUrls.githubOAuth}>
              View step-by-step instructions
            </TextLink>
          </Trans>
        ) : type === 'gitlabOAuth' ? (
          <Trans i18nKey="provisioning.oauth-app.help-instructions-gitlab">
            In GitLab, go to your user or group settings and create an application with the callback URL below, then
            paste its application ID and secret here.{' '}
            <TextLink external href={docsUrls.gitlabOAuth}>
              View step-by-step instructions
            </TextLink>
            . Create the application with this scope:
          </Trans>
        ) : (
          <Trans i18nKey="provisioning.oauth-app.help-instructions-bitbucket">
            In Bitbucket, go to your workspace settings and add an OAuth consumer with the callback URL below, then
            paste its key and secret here.{' '}
            <TextLink external href={docsUrls.bitbucketOAuth}>
              View step-by-step instructions
            </TextLink>
            . Add the consumer with these permissions:
          </Trans>
        )
      }
    >
      {type === 'gitlabOAuth' && (
        <Box element="ul" margin={0} paddingLeft={3}>
          <li>
            <code>{GITLAB_SCOPE}</code>
          </li>
        </Box>
      )}

      {type === 'bitbucketOAuth' && (
        <Box element="ul" margin={0} paddingLeft={3}>
          <li>
            <Trans i18nKey="provisioning.oauth-app.scope-bitbucket-repositories">Repositories</Trans>:{' '}
            <code>{t('provisioning.oauth-app.scope-bitbucket-read-write', 'Read and write')}</code>
          </li>
          <li>
            <Trans i18nKey="provisioning.oauth-app.scope-bitbucket-pull-requests">Pull requests</Trans>:{' '}
            <code>{t('provisioning.oauth-app.scope-bitbucket-read-write', 'Read and write')}</code>
          </li>
          <li>
            <Trans i18nKey="provisioning.oauth-app.scope-bitbucket-webhooks">Webhooks</Trans>:{' '}
            <code>{t('provisioning.oauth-app.scope-bitbucket-read-write', 'Read and write')}</code>
          </li>
        </Box>
      )}

      <Field
        noMargin
        label={t('provisioning.oauth-app.callback-url', 'Callback URL')}
        description={t(
          'provisioning.oauth-app.callback-url-description',
          'Copy and paste this URL when setting up the OAuth app'
        )}
      >
        <Input
          id="oauth-callback-url"
          value={callbackUri}
          readOnly
          addonAfter={
            <ClipboardButton icon="copy" getText={() => callbackUri}>
              <Trans i18nKey="provisioning.oauth-app.copy">Copy</Trans>
            </ClipboardButton>
          }
        />
      </Field>
    </InstructionSection>
  );
}

function InstructionSection({
  title,
  description,
  children,
}: {
  title: NonNullable<ReactNode>;
  description: NonNullable<ReactNode>;
  children?: ReactNode;
}) {
  return (
    <Stack direction="column" gap={2}>
      <div>
        <Text weight="bold" element="h6">
          {title}
        </Text>
        <Text element="p" color="secondary">
          {description}
        </Text>
      </div>
      {children}
    </Stack>
  );
}
