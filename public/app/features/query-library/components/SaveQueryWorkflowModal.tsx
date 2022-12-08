import { css } from '@emotion/css';
import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Form, Modal, VerticalGroup, TextArea } from '@grafana/ui';

import { WorkflowID } from '../../storage/types';
import { SavedQuery } from '../api/SavedQueriesApi';

interface FormDTO {
  message: string;
}

export interface SaveQueryOptions {
  savedQuery: SavedQuery;
  workflow: WorkflowID;
  message?: string;
}

export type SaveProps = {
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (options: SaveQueryOptions) => Promise<{ success: boolean }>;
  options: SaveQueryOptions;
  onOptionsChange: (opts: SaveQueryOptions) => void;
};

export const SaveQueryWorkflowModal = ({ options, onSubmit, onCancel, onSuccess }: SaveProps) => {
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      isOpen={true}
      title={options.workflow === WorkflowID.PR ? 'Create a Pull Request' : 'Push changes'}
      onDismiss={onCancel}
      icon="exclamation-triangle"
      className={css`
        width: 500px;
      `}
    >
      <Form
        onSubmit={async (data: FormDTO) => {
          console.log('hello submitting!');
          if (!onSubmit) {
            return;
          }
          setSaving(true);
          options = { ...options, message: data.message };
          const result = await onSubmit(options);
          if (result.success) {
            onSuccess();
          } else {
            setSaving(false);
          }
        }}
      >
        {({ register, errors }) => (
          <VerticalGroup>
            <TextArea {...register('message')} placeholder="Add a note to describe your changes." autoFocus rows={5} />

            <VerticalGroup>
              <Button variant="secondary" onClick={onCancel} fill="outline">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={false}
                icon={saving ? 'fa fa-spinner' : undefined}
                aria-label={selectors.pages.SaveDashboardModal.save}
              >
                {options.workflow === WorkflowID.PR ? 'Submit PR' : 'Push'}
              </Button>
            </VerticalGroup>
          </VerticalGroup>
        )}
      </Form>
    </Modal>
  );
};
