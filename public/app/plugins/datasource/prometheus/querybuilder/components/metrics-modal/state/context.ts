import React from 'react';

import { initialState } from './state';

const MetricsExplorerContext = React.createContext(initialState());

export function useMetricsModalContext() {
  return React.useContext(MetricsExplorerContext);
}

export default MetricsExplorerContext;
