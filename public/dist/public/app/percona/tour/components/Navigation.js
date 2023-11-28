import { components } from '@reactour/tour';
import React from 'react';
import { useTheme2 } from '@grafana/ui';
import NextButton from './NextButton';
import PrevButton from './PrevButton';
const Navigation = ({ setCurrentStep, steps, currentStep, disableDots, setIsOpen }) => {
    const theme = useTheme2();
    return (React.createElement(components.Navigation, { setCurrentStep: setCurrentStep, steps: steps, currentStep: currentStep, disableDots: disableDots, setIsOpen: setIsOpen, nextButton: NextButton, prevButton: PrevButton, styles: { dot: (base) => (Object.assign(Object.assign({}, base), { background: theme.colors.primary.main, color: theme.colors.primary.main })) } }));
};
export default Navigation;
//# sourceMappingURL=Navigation.js.map