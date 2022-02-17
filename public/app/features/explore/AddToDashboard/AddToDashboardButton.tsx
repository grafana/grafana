import React, { useState } from 'react';
import { ToolbarButton } from '@grafana/ui';
import { AddToDashboardModal } from './AddToDashboardModal';
import { DataQuery } from '@grafana/data';

interface Props {
  queries: DataQuery[];
  visualization: string;
}
export const AddToDashboardButton = ({ queries, visualization }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ToolbarButton icon="apps" onClick={() => setIsOpen(true)} aria-label="Add to Dashboard">
        Add to Dashboard
      </ToolbarButton>

      {isOpen && (
        <AddToDashboardModal onClose={() => setIsOpen(false)} queries={queries} visualization={visualization} />
      )}
    </>
  );
};
