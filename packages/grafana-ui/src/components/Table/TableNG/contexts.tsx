import memoize from 'micro-memoize';
import { createContext, ReactNode, useContext } from 'react';

import { getTextColorForBackground } from '../../../utils/colors';

const GetTextColorForBackgroundContext = createContext<typeof getTextColorForBackground>(getTextColorForBackground);
export const GetTextColorForBackgroundContextProvider = (props: { children: ReactNode }) => (
  <GetTextColorForBackgroundContext.Provider value={memoize(getTextColorForBackground, { maxSize: 1000 })}>
    {props.children}
  </GetTextColorForBackgroundContext.Provider>
);

export function useGetTextColorForBackground() {
  return useContext(GetTextColorForBackgroundContext);
}
