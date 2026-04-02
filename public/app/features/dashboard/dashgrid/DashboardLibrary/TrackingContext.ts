import { createContext, useContext } from 'react';

import { type EventLocation, type SourceEntryPoint } from './constants';

interface TrackingContextValue {
  sourceEntryPoint: SourceEntryPoint;
  eventLocation: EventLocation;
}

const TrackingContext = createContext<TrackingContextValue | undefined>(undefined);

export const TrackingProvider = TrackingContext.Provider;

export function useTrackingContext(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) {
    throw new Error('useTrackingContext must be used within a TrackingProvider');
  }
  return ctx;
}
