import React, { FC, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { Button, VerticalGroup } from '@grafana/ui';

import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { PanelEditorTabId } from './types';
import { locationService } from '@grafana/runtime';

export interface Props {
  message: string;
  dispatch?: Dispatch;
}

export const PanelNotSupported: FC<Props> = ({ message, dispatch: propsDispatch }) => {
  let dispatch = useDispatch();
  dispatch = propsDispatch ?? dispatch;
  const onBackToQueries = useCallback(() => {
    locationService.partial({ tab: PanelEditorTabId.Query });
  }, []);

  return (
    <Layout justify="center" style={{ marginTop: '100px' }}>
      <VerticalGroup spacing="md">
        <h2>{message}</h2>
        <div>
          <Button size="md" variant="secondary" icon="arrow-left" onClick={onBackToQueries}>
            Go back to Queries
          </Button>
        </div>
      </VerticalGroup>
    </Layout>
  );
};
