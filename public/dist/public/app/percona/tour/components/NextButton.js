import React from 'react';
import { Button, IconButton } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';
const NextButton = () => {
    const { tour, endTour, nextStep, isLastStep } = usePerconaTour();
    return isLastStep ? (React.createElement(Button, { onClick: () => tour && endTour(tour) }, "Done")) : (React.createElement(IconButton, { "aria-label": 'Next step', onClick: nextStep, name: "arrow-right", size: "lg" }));
};
export default NextButton;
//# sourceMappingURL=NextButton.js.map