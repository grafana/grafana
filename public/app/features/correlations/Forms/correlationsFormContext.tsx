import React, { createContext, PropsWithChildren, useContext } from 'react';

import { Correlation } from '../types';

export type CorrelationsFormContextData = {
  loading: boolean;
  correlation?: Correlation;
  readOnly: boolean;
};

export const CorrelationsFormContext = createContext<CorrelationsFormContextData>({
  loading: false,
  correlation: undefined,
  readOnly: false,
});

type Props = {
  data: CorrelationsFormContextData;
};

export const CorrelationsFormContextProvider = (props: PropsWithChildren<Props>) => {
  const { data, children } = props;
  return <CorrelationsFormContext.Provider value={data}>{children}</CorrelationsFormContext.Provider>;
};

export const useCorrelationsFormContext = () => {
  return useContext(CorrelationsFormContext);
};
