import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { Form } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { NotificationChannelForm } from './components/NotificationChannelForm';
import { createNotificationChannel, loadNotificationTypes, testNotificationChannel } from './state/actions';
import { resetSecureField } from './state/reducers';
import { defaultValues, mapChannelsToSelectableValue, transformSubmitData, transformTestData, } from './utils/notificationChannels';
class NewNotificationChannelPage extends PureComponent {
    constructor() {
        super(...arguments);
        this.onSubmit = (data) => {
            this.props.createNotificationChannel(transformSubmitData(Object.assign(Object.assign({}, defaultValues), data)));
        };
        this.onTestChannel = (data) => {
            this.props.testNotificationChannel(transformTestData(Object.assign(Object.assign({}, defaultValues), data)));
        };
    }
    componentDidMount() {
        this.props.loadNotificationTypes();
    }
    render() {
        const { navModel, notificationChannelTypes } = this.props;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, null,
                React.createElement("h2", { className: "page-sub-heading" }, "New notification channel"),
                React.createElement(Form, { onSubmit: this.onSubmit, validateOn: "onChange", defaultValues: defaultValues, maxWidth: 600 }, ({ register, errors, control, getValues, watch }) => {
                    const selectedChannel = notificationChannelTypes.find((c) => c.value === getValues().type.value);
                    return (React.createElement(NotificationChannelForm, { selectableChannels: mapChannelsToSelectableValue(notificationChannelTypes, true), selectedChannel: selectedChannel, onTestChannel: this.onTestChannel, register: register, errors: errors, getValues: getValues, control: control, watch: watch, imageRendererAvailable: config.rendererAvailable, resetSecureField: this.props.resetSecureField, secureFields: {} }));
                }))));
    }
}
const mapStateToProps = (state) => ({
    navModel: getNavModel(state.navIndex, 'channels'),
    notificationChannelTypes: state.notificationChannel.notificationChannelTypes,
});
const mapDispatchToProps = {
    createNotificationChannel,
    loadNotificationTypes,
    testNotificationChannel,
    resetSecureField,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(NewNotificationChannelPage);
//# sourceMappingURL=NewNotificationChannelPage.js.map