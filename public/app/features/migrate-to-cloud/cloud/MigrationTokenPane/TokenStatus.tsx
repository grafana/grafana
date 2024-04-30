import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

interface Props {
  hasToken: boolean;
  isFetching: boolean;
}

export const TokenStatus = ({ hasToken, isFetching }: Props) => {
  if (isFetching) {
    return <Skeleton width={100} />;
  }

  return hasToken ? (
    <Text color="success">
      <Trans i18nKey="migrate-to-cloud.token-status.active">Token created and active</Trans>
    </Text>
  ) : (
    <Trans i18nKey="migrate-to-cloud.token-status.no-active">No active token</Trans>
  );
};
