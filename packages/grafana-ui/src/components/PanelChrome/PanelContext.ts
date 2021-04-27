import { EventBusWithSource } from '@grafana/data';
import React from 'react';

interface PanelContext {
  eventBus?: EventBusWithSource;
}

const PanelContextRoot = React.createContext<PanelContext>({});

/**
 * @alpha
 */
export const PanelContextProvider = PanelContextRoot.Provider;

/**
 * @alpha
 */
export const usePanelContext = () => React.useContext(PanelContextRoot);
