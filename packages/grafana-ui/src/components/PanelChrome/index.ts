import React from 'react';
import { LoadingIndicator } from './LoadingIndicator';
import { PanelChromeProps, PanelChrome as PanelChromeComponent } from './PanelChrome';

export interface PanelChromeType extends React.FC<PanelChromeProps> {
  LoadingIndicator: typeof LoadingIndicator;
}

export const PanelChrome = PanelChromeComponent as PanelChromeType;
PanelChrome.LoadingIndicator = LoadingIndicator;
