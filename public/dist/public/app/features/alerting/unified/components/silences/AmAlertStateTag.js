var _a;
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import React from 'react';
import { StateTag } from '../StateTag';
var alertStateToState = (_a = {},
    _a[AlertState.Active] = 'bad',
    _a[AlertState.Unprocessed] = 'neutral',
    _a[AlertState.Suppressed] = 'info',
    _a);
export var AmAlertStateTag = function (_a) {
    var state = _a.state;
    return React.createElement(StateTag, { state: alertStateToState[state] }, state);
};
//# sourceMappingURL=AmAlertStateTag.js.map