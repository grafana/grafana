import React, { RefObject, useContext } from 'react';

export const ScrollElementsContext = React.createContext<ScrollElementsReturnType | undefined>(undefined);

type ScrollElementsReturnType = {
  scrollElement?: Element;
  topOfViewRef: RefObject<HTMLDivElement>;
};

/**
 * Use in panel that should show in Explore and need additional handles for customized scrolling.
 * Reasons this is not part of ExplorePanelProps is that it creates:
 * ERROR in ./public/app/store/configureStore.ts:19:17
 * TS2589: Type instantiation is excessively deep and possibly infinite.
 * Second not sure if we want to give access to this to all panels right away. Feel like there should be a way we can
 * without even in trace panel which is the only one that uses this.
 */
export function useScrollElements(): ScrollElementsReturnType | undefined {
  return useContext(ScrollElementsContext);
}
