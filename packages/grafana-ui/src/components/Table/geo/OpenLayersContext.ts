import { type Geometry } from 'ol/geom';
import { createContext, useContext } from 'react';

export interface OpenLayersContextValue {
  formatGeometry?: (value: Geometry) => string;
}

export const OpenLayersContext = createContext<OpenLayersContextValue>({});

export function useOpenLayersContext(): OpenLayersContextValue {
  return useContext(OpenLayersContext);
}
