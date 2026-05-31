import { Trans } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

export interface PushSuccessMessageProps {
  branch: string;
  url?: string;
}

export function PushSuccessMessage({ branch, url }: PushSuccessMessageProps) {
  return (
    <span>
      <Trans i18nKey="provisioned-request.push-success.prefix">Changes successfully pushed to</Trans>{' '}
      {url ? (
        <TextLink href={url} external>
          {branch}
        </TextLink>
      ) : (
        branch
      )}
    </span>
  );
}
