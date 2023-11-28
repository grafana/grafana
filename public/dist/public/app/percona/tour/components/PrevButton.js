import React from 'react';
import { IconButton } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';
const PrevButton = () => {
    const { previousStep, isFirstStep } = usePerconaTour();
    return React.createElement(IconButton, { onClick: previousStep, "aria-label": 'Previous step', name: "arrow-left", size: "lg", disabled: isFirstStep });
};
export default PrevButton;
//# sourceMappingURL=PrevButton.js.map