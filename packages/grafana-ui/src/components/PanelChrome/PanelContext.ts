import { EventBusSrv, EventBus } from '@grafana/data';
import React from 'react';

/** @alpha */
export interface PanelContext {
  eventBus: EventBus;
}

const PanelContextRoot = React.createContext<PanelContext>({
  eventBus: new EventBusSrv(),
});

/**
 * @alpha
 */
export const PanelContextProvider = PanelContextRoot.Provider;

/**
 * @alpha
 */
export const usePanelContext = () => React.useContext(PanelContextRoot);
