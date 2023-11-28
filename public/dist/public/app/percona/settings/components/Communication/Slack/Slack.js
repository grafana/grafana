import React, { useState } from 'react';
import { Form } from 'react-final-form';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { Messages } from '../Communication.messages';
export const Slack = ({ updateSettings, settings }) => {
    const settingsStyles = useStyles2(getSettingsStyles);
    const [loading, setLoading] = useState(false);
    const applyChanges = (values) => {
        updateSettings({
            slack_alerting_settings: values,
        }, setLoading);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Form, { onSubmit: applyChanges, initialValues: settings, render: ({ handleSubmit, valid, pristine }) => (React.createElement("form", { onSubmit: handleSubmit, "data-testid": "slack-form" },
                React.createElement("div", { className: settingsStyles.labelWrapper },
                    React.createElement("span", null, Messages.fields.slackURL.label),
                    React.createElement(LinkTooltip, { tooltipContent: Messages.fields.slackURL.tooltipText, link: Messages.fields.slackURL.tooltipLink, linkText: Messages.fields.slackURL.tooltipLinkText, icon: "info-circle" })),
                React.createElement(TextInputField, { name: "url" }),
                React.createElement(Button, { className: settingsStyles.actionButton, type: "submit", disabled: !valid || pristine || loading, "data-testid": "slack-settings--submit-button" },
                    loading && React.createElement(Spinner, null),
                    Messages.actionButton))) })));
};
//# sourceMappingURL=Slack.js.map