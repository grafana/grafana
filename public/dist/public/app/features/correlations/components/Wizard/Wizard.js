import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { WizardContent } from './WizardContent';
import { WizardContextProvider } from './wizardContext';
export function Wizard(props) {
    const { defaultValues, pages, onSubmit, navigation } = props;
    const formMethods = useForm({ defaultValues });
    return (React.createElement(FormProvider, Object.assign({}, formMethods),
        React.createElement(WizardContextProvider, { pages: pages, onSubmit: onSubmit },
            React.createElement(WizardContent, { navigation: navigation }))));
}
//# sourceMappingURL=Wizard.js.map