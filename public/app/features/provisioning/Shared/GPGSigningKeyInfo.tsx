import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, TextLink, useStyles2 } from '@grafana/ui';

import { type InstructionAvailability } from '../Wizard/types';

const PROVIDER_LINKS: Record<InstructionAvailability, string> = {
  github: 'https://docs.github.com/en/authentication/managing-commit-signature-verification',
  gitlab: 'https://docs.gitlab.com/user/project/repository/signed_commits/',
  bitbucket: 'https://confluence.atlassian.com/bitbucketserver/verify-commit-signatures-1279066267.html',
};

export function GPGSigningKeyInfo({ type }: { type: InstructionAvailability }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack gap={0.5} wrap={'wrap'}>
        <Trans i18nKey="provisioning.gpg-signing-key-info.description">
          To enable verified commits,{' '}
          <TextLink external href={PROVIDER_LINKS[type]}>
            set up commit signing
          </TextLink>{' '}
          for your account.
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
