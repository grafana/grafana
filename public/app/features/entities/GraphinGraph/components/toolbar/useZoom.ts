import { useState } from 'react';

import { MIN_ZOOM, MAX_ZOOM } from '../../constants';

interface FunHandleZoom {
  (isZoomIn: boolean, curZoom?: number): number;
}
interface FunUseZoom {
  (initZoom: number): [number, FunHandleZoom, (zoom: number) => void];
}

const getNextZoom = (curZoom: number, isZoomIn: boolean, minZoom: number, maxZoom: number) => {
  let zoom = curZoom + (isZoomIn ? 0.1 : -0.1);
  if (zoom < minZoom) {
    zoom = minZoom;
  } else if (zoom > maxZoom) {
    zoom = maxZoom;
  }
  return zoom;
};

const useZoom: FunUseZoom = (initZoom = 1) => {
  const [zoom, setZoom] = useState(initZoom);
  const handleZoom: FunHandleZoom = (isZoomIn, curZoom) => {
    const newZoom = getNextZoom(curZoom || zoom, isZoomIn, MIN_ZOOM, MAX_ZOOM);
    setZoom(newZoom);
    return newZoom;
  };
  return [zoom, handleZoom, setZoom];
};

export default useZoom;
