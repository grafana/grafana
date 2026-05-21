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
      <Stack direction="column" gap={1}>
        <Trans i18nKey="provisioning.gpg-signing-key-info.intro">
          Signed commits show as <strong>Verified</strong> on GitHub when three things match:
        </Trans>
        <ul className={styles.list}>
          <li>
            <Trans i18nKey="provisioning.gpg-signing-key-info.match-uid">
              The GPG key's UID email is also the commit author/committer email set below.
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
        <Stack gap={0.5} wrap="wrap">
          <TextLink external href={GPG_GENERATE_KEY_URL}>
            <Trans i18nKey="provisioning.gpg-signing-key-info.generate-link">Generate a GPG key</Trans>
          </TextLink>
          <Trans i18nKey="provisioning.gpg-signing-key-info.then">then</Trans>
          <TextLink external href={GPG_ADD_KEY_URL}>
            <Trans i18nKey="provisioning.gpg-signing-key-info.add-link">add the public key to your account</Trans>
          </TextLink>
          <Trans i18nKey="provisioning.gpg-signing-key-info.bot-tip">
            — typically a dedicated bot user that also owns the access token above.
          </Trans>
        </Stack>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginBottom: theme.spacing(1),
      padding: theme.spacing(theme.components.panel.padding),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    list: css({
      margin: 0,
      paddingLeft: theme.spacing(3),
      li: {
        marginBottom: theme.spacing(0.5),
      },
    }),
  };
}
