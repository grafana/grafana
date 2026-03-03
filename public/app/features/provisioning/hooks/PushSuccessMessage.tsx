import { t } from '@grafana/i18n';

export interface PushSuccessMessageProps {
  branch: string;
  repositoryURL?: string;
}

export function PushSuccessMessage({ branch, repositoryURL }: PushSuccessMessageProps) {
  const prefix = t('provisioned-request.push-success.prefix', 'Changes successfully pushed to ');

  if (repositoryURL) {
    return (
      <span>
        {prefix}
        <a href={repositoryURL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
          {branch}
        </a>
      </span>
    );
  }

  return (
    <span>
      {prefix}
      {branch}
    </span>
  );
}
