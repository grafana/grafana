import React, { useEffect } from 'react';
import { Wizard } from '../components/Wizard';
import { useCorrelations } from '../useCorrelations';
import { ConfigureCorrelationBasicInfoForm } from './ConfigureCorrelationBasicInfoForm';
import { ConfigureCorrelationSourceForm } from './ConfigureCorrelationSourceForm';
import { ConfigureCorrelationTargetForm } from './ConfigureCorrelationTargetForm';
import { CorrelationFormNavigation } from './CorrelationFormNavigation';
import { CorrelationsFormContextProvider } from './correlationsFormContext';
export const EditCorrelationForm = ({ onUpdated, correlation, readOnly = false }) => {
    const { update: { execute, loading, error, value }, } = useCorrelations();
    const onSubmit = (data) => {
        return execute(Object.assign(Object.assign({}, data), { sourceUID: correlation.sourceUID, uid: correlation.uid }));
    };
    useEffect(() => {
        if (!error && !loading && value) {
            onUpdated();
        }
    }, [error, loading, value, onUpdated]);
    return (React.createElement(CorrelationsFormContextProvider, { data: { loading, readOnly, correlation } },
        React.createElement(Wizard, { defaultValues: correlation, pages: [ConfigureCorrelationBasicInfoForm, ConfigureCorrelationTargetForm, ConfigureCorrelationSourceForm], onSubmit: readOnly ? (e) => () => { } : onSubmit, navigation: CorrelationFormNavigation })));
};
//# sourceMappingURL=EditCorrelationForm.js.map