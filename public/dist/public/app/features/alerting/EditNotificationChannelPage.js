import React, { PureComponent } from 'react';
import { config } from '@grafana/runtime';
import { Form, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';
import { NotificationChannelForm } from './components/NotificationChannelForm';
import { loadNotificationChannel, testNotificationChannel, updateNotificationChannel } from './state/actions';
import { initialChannelState, resetSecureField } from './state/reducers';
import { mapChannelsToSelectableValue, transformSubmitData, transformTestData } from './utils/notificationChannels';
export class EditNotificationChannelPage extends PureComponent {
    constructor() {
        super(...arguments);
        this.onSubmit = (formData) => {
            const { notificationChannel } = this.props;
            this.props.updateNotificationChannel(Object.assign(Object.assign({}, transformSubmitData(Object.assign(Object.assign(Object.assign({}, notificationChannel), formData), { settings: Object.assign(Object.assign({}, notificationChannel.settings), formData.settings) }))), { id: notificationChannel.id }));
        };
        this.onTestChannel = (formData) => {
            const { notificationChannel } = this.props;
            /*
              Same as submit
             */
            this.props.testNotificationChannel(transformTestData(Object.assign(Object.assign(Object.assign({}, notificationChannel), formData), { settings: Object.assign(Object.assign({}, notificationChannel.settings), formData.settings) })));
        };
    }
    componentDidMount() {
        this.props.loadNotificationChannel(parseInt(this.props.match.params.id, 10));
    }
    render() {
        const { notificationChannel, notificationChannelTypes } = this.props;
        return (React.createElement(Page, { navId: "channels" },
            React.createElement(Page.Contents, null,
                React.createElement("h2", { className: "page-sub-heading" }, "Edit notification channel"),
                notificationChannel && notificationChannel.id > 0 ? (React.createElement(Form, { maxWidth: 600, onSubmit: this.onSubmit, defaultValues: Object.assign(Object.assign({}, notificationChannel), { type: notificationChannelTypes.find((n) => n.value === notificationChannel.type) }) }, ({ control, errors, getValues, register, watch }) => {
                    const selectedChannel = notificationChannelTypes.find((c) => c.value === getValues().type.value);
                    return (React.createElement(NotificationChannelForm, { selectableChannels: mapChannelsToSelectableValue(notificationChannelTypes, true), selectedChannel: selectedChannel, imageRendererAvailable: config.rendererAvailable, onTestChannel: this.onTestChannel, register: register, watch: watch, errors: errors, getValues: getValues, control: control, resetSecureField: this.props.resetSecureField, secureFields: notificationChannel.secureFields }));
                })) : (React.createElement("div", null,
                    "Loading notification channel",
                    React.createElement(Spinner, null))))));
    }
}
const mapStateToProps = (state) => {
    return {
        notificationChannel: state.notificationChannel.notificationChannel,
        notificationChannelTypes: state.notificationChannel.notificationChannelTypes,
    };
};
const mapDispatchToProps = {
    loadNotificationChannel,
    testNotificationChannel,
    updateNotificationChannel,
    resetSecureField,
};
export default connectWithCleanUp(mapStateToProps, mapDispatchToProps, (state) => (state.notificationChannel = initialChannelState))(EditNotificationChannelPage);
//# sourceMappingURL=EditNotificationChannelPage.js.map