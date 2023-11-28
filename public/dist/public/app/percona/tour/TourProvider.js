import { TourProvider } from '@reactour/tour';
import React from 'react';
import { config } from '@grafana/runtime';
import { getTheme } from '@grafana/ui';
import usePerconaTour from 'app/percona/shared/core/hooks/tour';
import Close from './components/Close';
import Navigation from './components/Navigation';
const PerconaTourProvider = ({ children }) => {
    const { tour, steps, endTour } = usePerconaTour();
    return (React.createElement(TourProvider, { steps: steps, components: { Close, Navigation }, showBadge: false, badgeContent: ({ totalSteps, currentStep }) => `${currentStep + 1}/${totalSteps}`, disableFocusLock: true, onClickClose: ({ setIsOpen, setCurrentStep }) => {
            tour && endTour(tour);
            setCurrentStep(0);
            setIsOpen(false);
        }, onClickMask: ({ setCurrentStep, setIsOpen }) => {
            tour && endTour(tour);
            setCurrentStep(0);
            setIsOpen(false);
        }, className: "pmm-tour", styles: {
            popover: (base) => (Object.assign(Object.assign({}, base), { backgroundColor: getTheme(config.bootData.user.lightTheme ? 'light' : 'dark').colors.bg1 })),
        } }, children));
};
export default PerconaTourProvider;
//# sourceMappingURL=TourProvider.js.map