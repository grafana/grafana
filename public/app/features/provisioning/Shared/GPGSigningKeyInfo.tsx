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
        <Trans i18nKey="provisioning.gpg-signing-key-info.required">
          If you require verified commits,
        </Trans>
        <TextLink external href={GPG_GENERATE_KEY_URL}>
          <Trans i18nKey="provisioning.gpg-signing-key-info.generate-link">generate a GPG key</Trans>
        </TextLink>
        <Trans i18nKey="provisioning.gpg-signing-key-info.then">then</Trans>
        <TextLink external href={GPG_ADD_KEY_URL}>
          <Trans i18nKey="provisioning.gpg-signing-key-info.add-link">add it to a GitHub account</Trans>
        </TextLink>
        <Trans i18nKey="provisioning.gpg-signing-key-info.period">.</Trans>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
