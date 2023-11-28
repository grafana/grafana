import React from 'react';
import { Button, HorizontalGroup } from '@grafana/ui';
import { useWizardContext } from '../components/Wizard/wizardContext';
import { useCorrelationsFormContext } from './correlationsFormContext';
export const CorrelationFormNavigation = () => {
    const { currentPage, prevPage, isLastPage } = useWizardContext();
    const { readOnly, loading, correlation } = useCorrelationsFormContext();
    const LastPageNext = !readOnly && (React.createElement(Button, { variant: "primary", icon: loading ? 'fa fa-spinner' : 'save', type: "submit", disabled: loading }, correlation === undefined ? 'Add' : 'Save'));
    const NextPage = (React.createElement(Button, { variant: "primary", type: "submit" }, "Next"));
    return (React.createElement(HorizontalGroup, { justify: "flex-start" },
        currentPage > 0 ? (React.createElement(Button, { variant: "secondary", onClick: prevPage }, "Back")) : undefined,
        isLastPage ? LastPageNext : NextPage));
};
//# sourceMappingURL=CorrelationFormNavigation.js.map