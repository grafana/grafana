import { Trans } from '@grafana/i18n';
import { Text, TextLink } from '@grafana/ui';

const githubAppDocsUrl = 'https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app';

export function GithubAppStepInstruction() {
  return (
    <div>
      <Text weight="bold" element="h6">
        <Trans i18nKey="provisioning.wizard.github-app-help-title">Need help creating a GitHub App?</Trans>
      </Text>

      <Text element="p" color="secondary">
        <Trans i18nKey="provisioning.wizard.github-app-help-instructions">
          Create a GitHub App, generate a private key, install it, and paste the details below.{' '}
          <TextLink external href={githubAppDocsUrl}>
            View step-by-step instructions
          </TextLink>
        </Trans>
      </Text>
    </div>
  );
}
