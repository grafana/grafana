var _a;
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';
import { StateTag } from '../StateTag';
var silenceStateToState = (_a = {},
    _a[SilenceState.Active] = 'good',
    _a[SilenceState.Expired] = 'neutral',
    _a[SilenceState.Pending] = 'neutral',
    _a);
export var SilenceStateTag = function (_a) {
    var state = _a.state;
    return (React.createElement(StateTag, { state: silenceStateToState[state] }, state));
};
//# sourceMappingURL=SilenceStateTag.js.map