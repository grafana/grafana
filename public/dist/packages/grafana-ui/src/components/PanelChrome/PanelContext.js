import { EventBusSrv, } from '@grafana/data';
import React from 'react';
export var PanelContextRoot = React.createContext({
    eventBus: new EventBusSrv(),
});
/**
 * @alpha
 */
export var PanelContextProvider = PanelContextRoot.Provider;
/**
 * @alpha
 */
export var usePanelContext = function () { return React.useContext(PanelContextRoot); };
//# sourceMappingURL=PanelContext.js.map