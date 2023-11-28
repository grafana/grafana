import React from 'react';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { StateTag } from '../StateTag';
const alertStateToState = {
    [AlertState.Active]: 'bad',
    [AlertState.Unprocessed]: 'neutral',
    [AlertState.Suppressed]: 'info',
};
// @PERCONA
export const AmAlertStateTag = ({ state, silenced }) => (React.createElement(StateTag, { state: alertStateToState[state] }, state === 'suppressed' && silenced ? silenced : state));
//# sourceMappingURL=AmAlertStateTag.js.map