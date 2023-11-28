import React from 'react';
import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
export const AlertStateTag = React.memo(({ state, isPaused = false, size = 'md', muted = false }) => (React.createElement(StateTag, { state: alertStateToState(state), size: size, muted: muted },
    alertStateToReadable(state),
    " ",
    isPaused ? ' (Paused)' : '')));
AlertStateTag.displayName = 'AlertStateTag';
//# sourceMappingURL=AlertStateTag.js.map