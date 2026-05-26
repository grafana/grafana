import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, TextLink, useStyles2 } from '@grafana/ui';

import { type InstructionAvailability } from '../Wizard/types';

const PROVIDER_LINKS: Record<InstructionAvailability, { generate: string; add: string }> = {
  github: {
    generate:
      'https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key',
    add: 'https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account',
  },
  gitlab: {
    generate: 'https://docs.gitlab.com/user/project/repository/signed_commits/gpg/',
    add: 'https://docs.gitlab.com/user/project/repository/signed_commits/gpg/#add-a-gpg-key-to-your-account',
  },
  bitbucket: {
    generate: 'https://support.atlassian.com/bitbucket-cloud/docs/use-gpg-keys/',
    add: 'https://support.atlassian.com/bitbucket-cloud/docs/use-gpg-keys/',
  },
};

export function GPGSigningKeyInfo({ type }: { type: InstructionAvailability }) {
  const styles = useStyles2(getStyles);
  const { generate, add } = PROVIDER_LINKS[type];

  return (
    <div className={styles.container}>
      <Stack gap={0.5} wrap={'wrap'}>
        <Trans i18nKey="provisioning.gpg-signing-key-info.description">
          To enable verified commits,{' '}
          <TextLink external href={generate}>
            generate a GPG key
          </TextLink>{' '}
          and{' '}
          <TextLink external href={add}>
            add it to your account
          </TextLink>
          .
        </Trans>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginBottom: theme.spacing(1),
      position: 'relative',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      padding: theme.spacing(theme.components.panel.padding),
    }),
  };
}
