import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, TextLink, useStyles2 } from '@grafana/ui';

import { type InstructionAvailability } from '../Wizard/types';

const GITHUB_GPG_GENERATE_URL =
  'https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key';
const GITHUB_GPG_ADD_URL =
  'https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account';
const GITLAB_GPG_GENERATE_URL = 'https://docs.gitlab.com/user/project/repository/signed_commits/gpg/';
const GITLAB_GPG_ADD_URL =
  'https://docs.gitlab.com/user/project/repository/signed_commits/gpg/#add-a-gpg-key-to-your-account';

export function GPGSigningKeyInfo({ type }: { type: InstructionAvailability }) {
  const styles = useStyles2(getStyles);
  if (type !== 'github' && type !== 'gitlab') {
    return null;
  }
  const generateUrl = type === 'github' ? GITHUB_GPG_GENERATE_URL : GITLAB_GPG_GENERATE_URL;
  const addUrl = type === 'github' ? GITHUB_GPG_ADD_URL : GITLAB_GPG_ADD_URL;
  return (
    <div className={styles.container}>
      <Stack gap={0.5} wrap={'wrap'}>
        <Trans i18nKey="provisioning.gpg-signing-key-info.required">
          If you require verified commits,
        </Trans>
        <TextLink external href={generateUrl}>
          <Trans i18nKey="provisioning.gpg-signing-key-info.generate-link">generate a GPG key</Trans>
        </TextLink>
        <Trans i18nKey="provisioning.gpg-signing-key-info.then">then</Trans>
        <TextLink external href={addUrl}>
          {type === 'github' ? (
            <Trans i18nKey="provisioning.gpg-signing-key-info.add-link-github">add it to a GitHub account</Trans>
          ) : (
            <Trans i18nKey="provisioning.gpg-signing-key-info.add-link-gitlab">add it to a GitLab account</Trans>
          )}
        </TextLink>
        <Trans i18nKey="provisioning.gpg-signing-key-info.period">.</Trans>
      </Stack>
    </div>
  );
}

function getStyles() {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
