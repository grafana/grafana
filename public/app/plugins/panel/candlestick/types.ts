import {
  defaultPanelOptions as defaultPanelOptionsBase,
  defaultCandlestickColors,
  PanelOptions,
  CandlestickColors,
} from './panelcfg.gen';

export const defaultPanelOptions: Partial<PanelOptions> = {
  ...defaultPanelOptionsBase,
  colors: defaultCandlestickColors as CandlestickColors,
};
