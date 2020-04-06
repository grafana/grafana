import React, { FC, useState, useEffect } from 'react';
import { appEvents } from 'app/core/core';
import { CoreEvents } from 'app/types';
import { DashboardSearch } from './DashboardSearch';
import { OpenSearchParams } from '../types';

export const SearchWrapper: FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState({});

  useEffect(() => {
    const openSearch = (payload: OpenSearchParams) => {
      setIsOpen(true);
      setPayload(payload);
    };

    const closeOnItemClick = (payload: any) => {
      // Detect if the event was emitted by clicking on search item
      if (payload?.target === 'search-item' && isOpen) {
        setIsOpen(false);
      }
    };

    appEvents.on(CoreEvents.showDashSearch, openSearch);
    appEvents.on(CoreEvents.hideDashSearch, closeOnItemClick);

    return () => {
      appEvents.off(CoreEvents.showDashSearch, openSearch);
      appEvents.off(CoreEvents.hideDashSearch, closeOnItemClick);
    };
  }, [isOpen]);

  return (
    isOpen && (
      <>
        <div className="search-backdrop" />
        <DashboardSearch closeSearch={() => setIsOpen(false)} payload={payload} />
      </>
    )
  );
};
