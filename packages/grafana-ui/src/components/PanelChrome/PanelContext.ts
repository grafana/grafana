import { EventBusWithSource } from '@grafana/data';
import React from 'react';

export interface PanelContextObject {
  eventBus?: EventBusWithSource;
}

export const PanelContext = React.createContext<PanelContextObject>({});
