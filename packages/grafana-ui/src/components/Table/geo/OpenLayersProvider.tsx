import WKT from 'ol/format/WKT';
import { type ReactNode, useMemo } from 'react';

import { OpenLayersContext, type OpenLayersContextValue } from './OpenLayersContext';

interface Props {
  children: ReactNode;
}

export function OpenLayersProvider({ children }: Props) {
  const wkt = useMemo(() => new WKT(), []);
  const value = useMemo<OpenLayersContextValue>(
    () => ({
      formatGeometry: (geometry) =>
        wkt.writeGeometry(geometry, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326',
        }),
    }),
    [wkt]
  );

  return <OpenLayersContext.Provider value={value}>{children}</OpenLayersContext.Provider>;
}
