import React, { useState } from 'react';
import { ExploreId } from 'app/types';
import { AddToDashboardModal } from './AddToDashboardModal';
import { ToolbarButton } from '@grafana/ui';
import { useSelector } from 'react-redux';
import { getExploreItemSelector } from '../state/selectors';

interface Props {
  exploreId: ExploreId;
}

export const AddToDashboard = ({ exploreId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectExploreItem = getExploreItemSelector(exploreId);
  const explorePaneHasQueries = !!useSelector(selectExploreItem)?.queries?.length;

  return (
    <>
      <ToolbarButton
        icon="apps"
        onClick={() => setIsOpen(true)}
        aria-label="Add to dashboard"
        disabled={!explorePaneHasQueries}
      >
        Add to dashboard
      </ToolbarButton>

      {isOpen && <AddToDashboardModal onClose={() => setIsOpen(false)} exploreId={exploreId} />}
    </>
  );
};
