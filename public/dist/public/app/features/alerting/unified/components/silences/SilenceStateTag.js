import React from 'react';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { StateTag } from '../StateTag';
const silenceStateToState = {
    [SilenceState.Active]: 'good',
    [SilenceState.Expired]: 'neutral',
    [SilenceState.Pending]: 'neutral',
};
export const SilenceStateTag = ({ state }) => React.createElement(StateTag, { state: silenceStateToState[state] }, state);
//# sourceMappingURL=SilenceStateTag.js.map