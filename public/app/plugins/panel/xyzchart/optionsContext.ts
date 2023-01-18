import React from 'react';

import { ScatterPlotOptions } from './models.gen';

const opts: ScatterPlotOptions = {
  pointColor: '',
  pointSize: 0,
  seriesMapping: 'auto',
};

const OptionsContext = React.createContext(opts);
export const OptionsProvider = OptionsContext.Provider;
export default OptionsContext;
