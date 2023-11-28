import React, { createContext, useContext, useState } from 'react';
export const WizardContext = createContext(undefined);
/**
 * Context providing current state and logic of a Wizard. Can be used by pages and navigation components.
 */
export function WizardContextProvider(props) {
    const [currentPage, setCurrentPage] = useState(0);
    const { pages, onSubmit, children } = props;
    return (React.createElement(WizardContext.Provider, { value: {
            currentPage,
            CurrentPageComponent: pages[currentPage],
            isLastPage: currentPage === pages.length - 1,
            nextPage: () => setCurrentPage(currentPage + 1),
            prevPage: () => setCurrentPage(currentPage - 1),
            // @ts-expect-error
            onSubmit,
        } }, children));
}
export const useWizardContext = () => {
    const ctx = useContext(WizardContext);
    if (!ctx) {
        throw new Error('useWizardContext must be used within a WizardContextProvider');
    }
    return ctx;
};
//# sourceMappingURL=wizardContext.js.map