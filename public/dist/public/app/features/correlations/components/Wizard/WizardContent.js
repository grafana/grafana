import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useWizardContext } from './wizardContext';
export function WizardContent(props) {
    const { navigation } = props;
    const { handleSubmit } = useFormContext();
    const { CurrentPageComponent, isLastPage, nextPage, onSubmit } = useWizardContext();
    const NavigationComponent = navigation;
    return (React.createElement("form", { onSubmit: handleSubmit((data) => {
            if (isLastPage) {
                onSubmit(data);
            }
            else {
                nextPage();
            }
        }) },
        React.createElement(CurrentPageComponent, null),
        React.createElement(NavigationComponent, null)));
}
//# sourceMappingURL=WizardContent.js.map