import React from 'react';
import { Icon, Input } from '@grafana/ui';
import { HoverCard } from '../HoverCard';
import { PromDurationDocs } from './PromDurationDocs';
export const PromDurationInput = React.forwardRef((props, ref) => {
    return (React.createElement(Input, Object.assign({ suffix: React.createElement(HoverCard, { content: React.createElement(PromDurationDocs, null), disabled: false },
            React.createElement(Icon, { name: "info-circle", size: "lg" })) }, props, { ref: ref })));
});
PromDurationInput.displayName = 'PromDurationInput';
//# sourceMappingURL=PromDurationInput.js.map