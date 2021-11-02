import React from 'react';
import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
export var AlertStateTag = function (_a) {
    var state = _a.state;
    return (React.createElement(StateTag, { state: alertStateToState[state] }, alertStateToReadable(state)));
};
//# sourceMappingURL=AlertStateTag.js.map