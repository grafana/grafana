import React, { createContext, Dispatch, PropsWithChildren, useContext } from 'react';
import { AnyAction } from '@reduxjs/toolkit';

type Props = {
  dispatch: Dispatch<AnyAction>;
};

const DispatchContext = createContext<Dispatch<AnyAction>>({} as Dispatch<AnyAction>);

export const useDispatch = () => {
  return useContext(DispatchContext);
};

export const GraphiteContext = ({ children, dispatch }: PropsWithChildren<Props>) => {
  return <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>;
};
