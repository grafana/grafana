import { useCallback } from 'react';

import { Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';

import { PanelEditorTabId } from './types';

export interface Props {
  message: string;
}

export function PanelNotSupported({ message }: Props): JSX.Element {
  const onBackToQueries = useCallback(() => {
    locationService.partial({ tab: PanelEditorTabId.Query });
  }, []);

  return (
    <div style={{ marginTop: '100px' }}>
      <Stack direction="row" justifyContent="center">
        <Stack direction="column" gap={2}>
          <h2>{message}</h2>
          <div>
            <Button size="md" variant="secondary" icon="arrow-left" onClick={onBackToQueries}>
              <Trans i18nKey="dashboard.panel-not-supported.go-back-to-queries">Go back to Queries</Trans>
            </Button>
          </div>
        </Stack>
      </Stack>
    </div>
  );
}
