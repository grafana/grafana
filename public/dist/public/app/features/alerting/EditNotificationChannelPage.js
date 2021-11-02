import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { config } from '@grafana/runtime';
import { Form, Spinner } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';
import { NotificationChannelForm } from './components/NotificationChannelForm';
import { loadNotificationChannel, testNotificationChannel, updateNotificationChannel } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { mapChannelsToSelectableValue, transformSubmitData, transformTestData } from './utils/notificationChannels';
import { resetSecureField } from './state/reducers';
var EditNotificationChannelPage = /** @class */ (function (_super) {
    __extends(EditNotificationChannelPage, _super);
    function EditNotificationChannelPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onSubmit = function (formData) {
            var notificationChannel = _this.props.notificationChannel;
            _this.props.updateNotificationChannel(__assign(__assign({}, transformSubmitData(__assign(__assign(__assign({}, notificationChannel), formData), { settings: __assign(__assign({}, notificationChannel.settings), formData.settings) }))), { id: notificationChannel.id }));
        };
        _this.onTestChannel = function (formData) {
            var notificationChannel = _this.props.notificationChannel;
            /*
              Same as submit
             */
            _this.props.testNotificationChannel(transformTestData(__assign(__assign(__assign({}, notificationChannel), formData), { settings: __assign(__assign({}, notificationChannel.settings), formData.settings) })));
        };
        return _this;
    }
    EditNotificationChannelPage.prototype.componentDidMount = function () {
        this.props.loadNotificationChannel(parseInt(this.props.match.params.id, 10));
    };
    EditNotificationChannelPage.prototype.render = function () {
        var _this = this;
        var _a = this.props, navModel = _a.navModel, notificationChannel = _a.notificationChannel, notificationChannelTypes = _a.notificationChannelTypes;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, null,
                React.createElement("h2", { className: "page-sub-heading" }, "Edit notification channel"),
                notificationChannel && notificationChannel.id > 0 ? (React.createElement(Form, { maxWidth: 600, onSubmit: this.onSubmit, defaultValues: __assign(__assign({}, notificationChannel), { type: notificationChannelTypes.find(function (n) { return n.value === notificationChannel.type; }) }) }, function (_a) {
                    var control = _a.control, errors = _a.errors, getValues = _a.getValues, register = _a.register, watch = _a.watch;
                    var selectedChannel = notificationChannelTypes.find(function (c) { return c.value === getValues().type.value; });
                    return (React.createElement(NotificationChannelForm, { selectableChannels: mapChannelsToSelectableValue(notificationChannelTypes, true), selectedChannel: selectedChannel, imageRendererAvailable: config.rendererAvailable, onTestChannel: _this.onTestChannel, register: register, watch: watch, errors: errors, getValues: getValues, control: control, resetSecureField: _this.props.resetSecureField, secureFields: notificationChannel.secureFields }));
                })) : (React.createElement("div", null,
                    "Loading notification channel",
                    React.createElement(Spinner, null))))));
    };
    return EditNotificationChannelPage;
}(PureComponent));
export { EditNotificationChannelPage };
var mapStateToProps = function (state) {
    return {
        navModel: getNavModel(state.navIndex, 'channels'),
        notificationChannel: state.notificationChannel.notificationChannel,
        notificationChannelTypes: state.notificationChannel.notificationChannelTypes,
    };
};
var mapDispatchToProps = {
    loadNotificationChannel: loadNotificationChannel,
    testNotificationChannel: testNotificationChannel,
    updateNotificationChannel: updateNotificationChannel,
    resetSecureField: resetSecureField,
};
export default connectWithCleanUp(mapStateToProps, mapDispatchToProps, function (state) { return state.notificationChannel; })(EditNotificationChannelPage);
//# sourceMappingURL=EditNotificationChannelPage.js.map