import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { Form } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { NotificationChannelForm } from './components/NotificationChannelForm';
import { defaultValues, mapChannelsToSelectableValue, transformSubmitData, transformTestData, } from './utils/notificationChannels';
import { getNavModel } from 'app/core/selectors/navModel';
import { createNotificationChannel, loadNotificationTypes, testNotificationChannel } from './state/actions';
import { resetSecureField } from './state/reducers';
var NewNotificationChannelPage = /** @class */ (function (_super) {
    __extends(NewNotificationChannelPage, _super);
    function NewNotificationChannelPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onSubmit = function (data) {
            _this.props.createNotificationChannel(transformSubmitData(__assign(__assign({}, defaultValues), data)));
        };
        _this.onTestChannel = function (data) {
            _this.props.testNotificationChannel(transformTestData(__assign(__assign({}, defaultValues), data)));
        };
        return _this;
    }
    NewNotificationChannelPage.prototype.componentDidMount = function () {
        this.props.loadNotificationTypes();
    };
    NewNotificationChannelPage.prototype.render = function () {
        var _this = this;
        var _a = this.props, navModel = _a.navModel, notificationChannelTypes = _a.notificationChannelTypes;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, null,
                React.createElement("h2", { className: "page-sub-heading" }, "New notification channel"),
                React.createElement(Form, { onSubmit: this.onSubmit, validateOn: "onChange", defaultValues: defaultValues, maxWidth: 600 }, function (_a) {
                    var register = _a.register, errors = _a.errors, control = _a.control, getValues = _a.getValues, watch = _a.watch;
                    var selectedChannel = notificationChannelTypes.find(function (c) { return c.value === getValues().type.value; });
                    return (React.createElement(NotificationChannelForm, { selectableChannels: mapChannelsToSelectableValue(notificationChannelTypes, true), selectedChannel: selectedChannel, onTestChannel: _this.onTestChannel, register: register, errors: errors, getValues: getValues, control: control, watch: watch, imageRendererAvailable: config.rendererAvailable, resetSecureField: _this.props.resetSecureField, secureFields: {} }));
                }))));
    };
    return NewNotificationChannelPage;
}(PureComponent));
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'channels'),
    notificationChannelTypes: state.notificationChannel.notificationChannelTypes,
}); };
var mapDispatchToProps = {
    createNotificationChannel: createNotificationChannel,
    loadNotificationTypes: loadNotificationTypes,
    testNotificationChannel: testNotificationChannel,
    resetSecureField: resetSecureField,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(NewNotificationChannelPage);
//# sourceMappingURL=NewNotificationChannelPage.js.map