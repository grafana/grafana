import { useCallback } from 'react';

import { locationService } from '@grafana/runtime';
import { Button, VerticalGroup } from '@grafana/ui';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Trans } from 'app/core/internationalization';

import { PanelEditorTabId } from './types';

export interface Props {
  message: string;
}

export function PanelNotSupported({ message }: Props): JSX.Element {
  const onBackToQueries = useCallback(() => {
    locationService.partial({ tab: PanelEditorTabId.Query });
  }, []);

  return (
    <Layout justify="center" style={{ marginTop: '100px' }}>
      <VerticalGroup spacing="md">
        <h2>{message}</h2>
        <div>
          <Button size="md" variant="secondary" icon="arrow-left" onClick={onBackToQueries}>
            <Trans i18nKey="dashboard.panel-not-supported.go-back-to-queries">Go back to Queries</Trans>
          </Button>
        </div>
      </VerticalGroup>
    </Layout>
  );
}
