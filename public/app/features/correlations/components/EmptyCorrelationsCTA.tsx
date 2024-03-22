import React from 'react';

import { Button } from '@grafana/ui';
import { EmptyState } from '@grafana/ui/src/components/EmptyState/EmptyState';
import { Trans, t } from 'app/core/internationalization';

interface Props {
  onClick: () => void;
  canWriteCorrelations: boolean;
}
export const EmptyCorrelationsCTA = ({ onClick, canWriteCorrelations }: Props) => {
  // TODO: if there are no datasources show a different message

  return (
    <EmptyState
      button={
        <Button disabled={!canWriteCorrelations} icon="gf-glue" onClick={onClick} size="lg">
          <Trans i18nKey="correlations.empty-state.button-title">Add correlation</Trans>
        </Button>
      }
      message={t('correlations.empty-state.title', "You haven't defined any correlations yet")}
    >
      <Trans i18nKey="correlations.empty-state.pro-tip">
        You can also define correlations via datasource provisioning
      </Trans>
    </EmptyState>
  );
};
