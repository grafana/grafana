import React, { FC, useState, useEffect } from 'react';
import { appEvents } from 'app/core/core';
import { CoreEvents } from 'app/types';
import { DashboardSearch } from './DashboardSearch';

export const SearchWrapper: FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    appEvents.on(CoreEvents.showDashSearch, () => setIsOpen(true));
    appEvents.on(CoreEvents.hideDashSearch, (payload: any) => {
      // Detect if the event was emitted by clicking on search item
      // TODO remove appEvents dependency
      if (payload?.target === 'search-item' && isOpen) {
        setIsOpen(false);
      }
    });
  }, []);

  return (
    isOpen && (
      <>
        <div className="search-backdrop" />
        <DashboardSearch closeSearch={() => setIsOpen(false)} />
      </>
    )
  );
};
