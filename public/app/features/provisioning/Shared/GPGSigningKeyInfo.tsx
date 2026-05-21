import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, TextLink, useStyles2 } from '@grafana/ui';

import { type InstructionAvailability } from '../Wizard/types';

const GPG_GENERATE_KEY_URL =
  'https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key';
const GPG_ADD_KEY_URL =
  'https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account';

export function GPGSigningKeyInfo({ type }: { type: InstructionAvailability }) {
  const styles = useStyles2(getStyles);
  if (type !== 'github') {
    return null;
  }
  return (
    <div className={styles.container}>
      <Stack gap={0.5} wrap={'wrap'}>
        <Trans i18nKey="provisioning.gpg-signing-key-info.intro">
          For GitHub to mark commits as Verified, three things must match:
        </Trans>
      </Stack>
      <ul className={styles.list}>
        <li>
          <Trans i18nKey="provisioning.gpg-signing-key-info.match-uid">
            The GPG key's UID email is the commit author/committer email set above.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.gpg-signing-key-info.match-account">
            That same email is a verified email on the GitHub account where the public key is registered.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.gpg-signing-key-info.unencrypted">
            The exported private key has no passphrase.
          </Trans>
        </li>
      </ul>
      <Stack gap={0.5} wrap={'wrap'}>
        <TextLink external href={GPG_GENERATE_KEY_URL}>
          <Trans i18nKey="provisioning.gpg-signing-key-info.generate-link">Generate a GPG key</Trans>
        </TextLink>
        <Trans i18nKey="provisioning.gpg-signing-key-info.then">then</Trans>
        <TextLink external href={GPG_ADD_KEY_URL}>
          <Trans i18nKey="provisioning.gpg-signing-key-info.add-link">add the public key to your account</Trans>
        </TextLink>
        <Trans i18nKey="provisioning.gpg-signing-key-info.bot-tip">
          (typically a dedicated bot user that also owns the access token).
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
    list: css({
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(3),

      li: css({
        marginBottom: theme.spacing(1),
      }),
    }),
  };
}
