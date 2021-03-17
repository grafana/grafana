import React from 'react';
import { LoadingIndicator } from './LoadingIndicator';
import { PanelChrome as PanelChromeComponent, PanelChromeProps } from './PanelChrome';

/**
 * @beta
 */
export { PanelChromeProps } from './PanelChrome';

/**
 * @beta
 */
export interface PanelChromeType extends React.FC<PanelChromeProps> {
  LoadingIndicator: typeof LoadingIndicator;
}

/**
 * @beta
 */
export const PanelChrome = PanelChromeComponent as PanelChromeType;
PanelChrome.LoadingIndicator = LoadingIndicator;
