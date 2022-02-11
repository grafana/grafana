import React, { useState } from 'react';
import { ToolbarButton } from '@grafana/ui';
import { AddToDashboardModal } from './AddToDashboardModal';
import { ExploreId } from 'app/types';

interface Props {
  exploreId: ExploreId;
}
export const AddToDashboardButton = ({ exploreId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ToolbarButton icon="apps" onClick={() => setIsOpen(true)}>
        Add to Dashboard
      </ToolbarButton>

      {isOpen && <AddToDashboardModal onClose={() => setIsOpen(false)} exploreId={exploreId} />}
    </>
  );
};
