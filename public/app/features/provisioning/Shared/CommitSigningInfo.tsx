import { Trans } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { type InstructionAvailability } from '../Wizard/types';

const PROVIDER_LINKS: Record<InstructionAvailability, string> = {
  github: 'https://docs.github.com/en/authentication/managing-commit-signature-verification',
  githubEnterprise: 'https://docs.github.com/en/authentication/managing-commit-signature-verification',
  gitlab: 'https://docs.gitlab.com/user/project/repository/signed_commits/',
  bitbucket: 'https://confluence.atlassian.com/bitbucketserver/verify-commit-signatures-1279066267.html',
};

export function CommitSigningInfo({ type }: { type: InstructionAvailability }) {
  return (
    <Trans i18nKey="provisioning.commit-signing-info.description">
      To enable verified commits,{' '}
      <TextLink external variant="bodySmall" href={PROVIDER_LINKS[type]}>
        set up commit signing
      </TextLink>{' '}
      for your account.
    </Trans>
  );
}
