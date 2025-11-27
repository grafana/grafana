import { createContext, useContext } from 'react';
import { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

interface TransformContextType {
  transformRef: React.RefObject<ReactZoomPanPinchRef> | null;
}

const TransformContext = createContext<TransformContextType>({ transformRef: null });

export const useTransformContext = () => {
  return useContext(TransformContext);
};

export const TransformProvider = TransformContext.Provider;
