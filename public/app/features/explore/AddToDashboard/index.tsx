import React, { useState } from 'react';

import { ToolbarButton } from '@grafana/ui';
import { ExploreId, useSelector } from 'app/types';

import { getExploreItemSelector } from '../state/selectors';

import { AddToDashboardModal } from './AddToDashboardModal';

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
