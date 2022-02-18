import React, { useState } from 'react';
import { ToolbarButton } from '@grafana/ui';
import { AddToDashboardModal } from './AddToDashboardModal';
import { DataQuery } from '@grafana/data';
import { PropsOf } from '@emotion/react';

interface Props {
  queries: DataQuery[];
  visualization: string;
  onSave: PropsOf<typeof AddToDashboardModal>['onSave'];
}
export const AddToDashboardButton = ({ queries, visualization, onSave }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ToolbarButton icon="apps" onClick={() => setIsOpen(true)} aria-label="Add to Dashboard">
        Add to Dashboard
      </ToolbarButton>

      {isOpen && (
        <AddToDashboardModal
          onClose={() => setIsOpen(false)}
          queries={queries}
          visualization={visualization}
          onSave={onSave}
        />
      )}
    </>
  );
};
