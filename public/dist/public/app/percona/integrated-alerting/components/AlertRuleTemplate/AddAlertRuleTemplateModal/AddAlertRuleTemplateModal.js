import { __awaiter } from "tslib";
import React, { useCallback, useRef } from 'react';
import { Form } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, Icon, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Messages } from 'app/percona/integrated-alerting/IntegratedAlerting.messages';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';
import { getStyles } from './AddAlertRuleTemplateModal.styles';
export const AddAlertRuleTemplateModal = ({ isVisible, setVisible, getAlertRuleTemplates, }) => {
    const styles = useStyles(getStyles);
    const { required } = validators;
    const inputRef = useRef(null);
    const onUploadFile = useCallback((change) => (event) => {
        const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;
        const reader = new FileReader();
        if (file) {
            reader.addEventListener('load', (e) => { var _a; return change('yaml', (_a = e.target) === null || _a === void 0 ? void 0 : _a.result); });
            reader.readAsText(file);
        }
    }, []);
    const onSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield AlertRuleTemplateService.upload(values);
            setVisible(false);
            appEvents.emit(AppEvents.alertSuccess, [Messages.alertRuleTemplate.addSuccess]);
            getAlertRuleTemplates();
        }
        catch (e) {
            logger.error(e);
        }
    });
    return (React.createElement(Modal, { title: Messages.alertRuleTemplate.addModal.title, isVisible: isVisible, onClose: () => setVisible(false) },
        React.createElement(Form, { onSubmit: onSubmit, render: ({ handleSubmit, valid, pristine, submitting, form: { change } }) => (React.createElement("form", { onSubmit: handleSubmit, "data-testid": "add-alert-rule-template-modal-form" },
                React.createElement(React.Fragment, null,
                    React.createElement("input", { type: "file", accept: ".yml, .yaml", ref: inputRef, onChange: onUploadFile(change), hidden: true }),
                    React.createElement(TextareaInputField, { name: "yaml", label: Messages.alertRuleTemplate.addModal.fields.alertRuleTemplate, validators: [required], className: styles.alertRuleTemplate }),
                    React.createElement(Button, { type: "button", "data-testid": "alert-rule-template-upload-button", size: "md", variant: "secondary", className: styles.uploadAction, onClick: () => { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.click(); } },
                        React.createElement(Icon, { name: "upload" }),
                        Messages.alertRuleTemplate.addModal.upload),
                    React.createElement(HorizontalGroup, { justify: "center", spacing: "md" },
                        React.createElement(LoaderButton, { "data-testid": "alert-rule-template-add-button", size: "md", variant: "primary", disabled: !valid || pristine, type: "submit", loading: submitting }, Messages.alertRuleTemplate.addModal.confirm),
                        React.createElement(Button, { "data-testid": "alert-rule-template-cancel-button", variant: "secondary", onClick: () => setVisible(false) }, Messages.alertRuleTemplate.addModal.cancel))))) })));
};
//# sourceMappingURL=AddAlertRuleTemplateModal.js.map