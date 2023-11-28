import { __awaiter } from "tslib";
import React from 'react';
import { withTypes } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { CheckService } from 'app/percona/check/Check.service';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { logger } from 'app/percona/shared/helpers/logger';
import { checkIntervalOptions } from './ChangeCheckIntervalModal.constants';
import { Messages } from './ChangeCheckIntervalModal.messages';
import { getStyles } from './ChangeCheckIntervalModal.styles';
const { Form } = withTypes();
export const ChangeCheckIntervalModal = ({ check, onClose, onIntervalChanged }) => {
    const styles = useStyles(getStyles);
    const { summary, name, interval } = check;
    const changeInterval = ({ interval }) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield CheckService.changeCheck({
                params: [
                    {
                        name: name,
                        interval,
                    },
                ],
            });
            appEvents.emit(AppEvents.alertSuccess, [Messages.getSuccess(summary)]);
            onIntervalChanged(Object.assign(Object.assign({}, check), { interval: interval }));
        }
        catch (e) {
            logger.error(e);
        }
    });
    const initialValues = {
        interval,
    };
    return (React.createElement(Modal, { "data-testid": "change-check-interval-modal", title: Messages.title, isVisible: true, onClose: onClose },
        React.createElement("div", { className: styles.content },
            React.createElement("h4", { className: styles.title }, Messages.getDescription(summary)),
            React.createElement(Form, { onSubmit: changeInterval, initialValues: initialValues, render: ({ handleSubmit, submitting, pristine }) => (React.createElement("form", { "data-testid": "change-check-interval-form", onSubmit: handleSubmit },
                    React.createElement("div", { "data-testid": "change-check-interval-radio-group-wrapper", className: styles.intervalRadioWrapper },
                        React.createElement(RadioButtonGroupField, { name: "interval", options: checkIntervalOptions })),
                    React.createElement(HorizontalGroup, { justify: "center", spacing: "md" },
                        React.createElement(LoaderButton, { disabled: submitting || pristine, loading: submitting, variant: "destructive", size: "md", "data-testid": "change-check-interval-modal-save", type: "submit" }, Messages.save),
                        React.createElement(Button, { variant: "secondary", size: "md", onClick: onClose, "data-testid": "change-check-interval-modal-cancel" }, Messages.cancel)))) }))));
};
//# sourceMappingURL=ChangeCheckIntervalModal.js.map