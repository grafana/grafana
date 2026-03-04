import { Trans } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

export interface PushSuccessMessageProps {
  branch: string;
  repositoryURL?: string;
}

export function PushSuccessMessage({ branch, repositoryURL }: PushSuccessMessageProps) {
  return (
    <span>
      <Trans i18nKey="provisioned-request.push-success.prefix">Changes successfully pushed to</Trans>{' '}
      {repositoryURL ? (
        <TextLink href={repositoryURL} external>
          {branch}
        </TextLink>
      ) : (
        branch
      )}
    </span>
  );
}
