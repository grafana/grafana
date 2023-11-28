import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { PanelContainer, useStyles2 } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { Wizard } from '../components/Wizard';
import { useCorrelations } from '../useCorrelations';
import { ConfigureCorrelationBasicInfoForm } from './ConfigureCorrelationBasicInfoForm';
import { ConfigureCorrelationSourceForm } from './ConfigureCorrelationSourceForm';
import { ConfigureCorrelationTargetForm } from './ConfigureCorrelationTargetForm';
import { CorrelationFormNavigation } from './CorrelationFormNavigation';
import { CorrelationsFormContextProvider } from './correlationsFormContext';
const getStyles = (theme) => ({
    panelContainer: css `
    position: relative;
    padding: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(2)};
  `,
    infoBox: css `
    margin-top: 20px; // give space for close button
  `,
});
export const AddCorrelationForm = ({ onClose, onCreated }) => {
    const styles = useStyles2(getStyles);
    const { create: { execute, loading, error, value }, } = useCorrelations();
    useEffect(() => {
        if (!error && !loading && value) {
            onCreated();
        }
    }, [error, loading, value, onCreated]);
    const defaultValues = { config: { type: 'query', target: {}, field: '' } };
    return (React.createElement(PanelContainer, { className: styles.panelContainer },
        React.createElement(CloseButton, { onClick: onClose }),
        React.createElement(CorrelationsFormContextProvider, { data: { loading, readOnly: false, correlation: undefined } },
            React.createElement(Wizard, { defaultValues: defaultValues, pages: [ConfigureCorrelationBasicInfoForm, ConfigureCorrelationTargetForm, ConfigureCorrelationSourceForm], navigation: CorrelationFormNavigation, onSubmit: execute }))));
};
//# sourceMappingURL=AddCorrelationForm.js.map