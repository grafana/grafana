import React from 'react';

import { ScatterPlotOptions } from './models.gen';

const OptionsContext = React.createContext({} as ScatterPlotOptions);
export const OptionsProvider = OptionsContext.Provider;
export default OptionsContext;
