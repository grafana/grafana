import Skeleton from 'react-loading-skeleton';

import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';

interface Props {
  hasToken: boolean;
  isFetching: boolean;
  errorMessageId: string | undefined;
}

export const TokenStatus = ({ hasToken, errorMessageId, isFetching }: Props) => {
  if (isFetching) {
    return <Skeleton width={100} />;
  } else if (hasToken) {
    return (
      <Text color="success">
        <Trans i18nKey="migrate-to-cloud.token-status.active">Token created and active</Trans>
      </Text>
    );
  } else if (errorMessageId === 'cloudmigrations.tokenNotFound') {
    return <Trans i18nKey="migrate-to-cloud.token-status.no-active">No active token</Trans>;
  } else if (errorMessageId) {
    return (
      <Text color="error">
        <Trans i18nKey="migrate-to-cloud.token-status.unknown-error">Error retrieving token</Trans>
      </Text>
    );
  }

  return (
    <Text color="warning">
      <Trans i18nKey="migrate-to-cloud.token-status.unknown">Unknown</Trans>
    </Text>
  );
};
