import React, { useState } from 'react';
import { ExploreId } from 'app/types';
import { AddToDashboardModal } from './AddToDashboardModal';
import { ToolbarButton } from '@grafana/ui';

interface Props {
  exploreId: ExploreId;
}

export const AddToDashboard = ({ exploreId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ToolbarButton icon="apps" onClick={() => setIsOpen(true)} aria-label="Add to dashboard">
        Add to dashboard
      </ToolbarButton>

      {isOpen && <AddToDashboardModal onClose={() => setIsOpen(false)} exploreId={exploreId} />}
    </>
  );
};
