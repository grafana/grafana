import React, { FC, useLayoutEffect } from 'react';

import { HorizontalGroup, Button } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { Messages } from '../../EditInstance.messages';

import { EditInstanceActionsProps } from './EditInstanceActions.types';

const EditInstanceActions: FC<EditInstanceActionsProps> = ({ onCancel, onSubmit, submitting }) => {
  const { chrome } = useGrafana();

  useLayoutEffect(() => {
    chrome.update({
      actions: (
        <HorizontalGroup height="auto" justify="flex-end">
          <Button size="sm" variant="secondary" data-testid="edit-instance-cancel" type="button" onClick={onCancel}>
            {Messages.cancel}
          </Button>
          <Button
            data-testid="edit-instance-submit"
            size="sm"
            type="submit"
            variant="primary"
            onClick={onSubmit}
            disabled={submitting}
          >
            {Messages.saveChanges}
          </Button>
        </HorizontalGroup>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrome, submitting]);

  return null;
};

export default EditInstanceActions;
