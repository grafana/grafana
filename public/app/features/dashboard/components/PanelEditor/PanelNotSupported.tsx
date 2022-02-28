import React, { useCallback } from 'react';
import { Alert, Button, FlexBox } from '@grafana/ui';
import { PanelEditorTabId } from './types';
import { locationService } from '@grafana/runtime';

export interface Props {
  message: string;
}

export function PanelNotSupported({ message }: Props): JSX.Element {
  const onBackToQueries = useCallback(() => {
    locationService.partial({ tab: PanelEditorTabId.Query });
  }, []);

  return (
    <FlexBox justifyContent="center" padding={2}>
      <Alert title={message}>
        <br />
        <Button size="md" variant="secondary" fill="outline" onClick={onBackToQueries}>
          Go back to Query tab
        </Button>
      </Alert>
    </FlexBox>
  );
}
