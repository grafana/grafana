import { __awaiter, __generator, __values } from "tslib";
import { find, map, reduce, remove } from 'lodash';
import coreModule from 'app/core/core_module';
import { ThresholdMapper } from './state/ThresholdMapper';
import { QueryPart } from 'app/core/components/query_part/query_part';
import alertDef from './state/alertDef';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import { getBackendSrv } from '@grafana/runtime';
import { rangeUtil } from '@grafana/data';
import { getDefaultCondition } from './getAlertingValidationMessage';
import { CoreEvents } from 'app/types';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';
import { ShowConfirmModalEvent } from '../../types/events';
var AlertTabCtrl = /** @class */ (function () {
    /** @ngInject */
    function AlertTabCtrl($scope, dashboardSrv, uiSegmentSrv, datasourceSrv) {
        var _this = this;
        this.$scope = $scope;
        this.dashboardSrv = dashboardSrv;
        this.uiSegmentSrv = uiSegmentSrv;
        this.datasourceSrv = datasourceSrv;
        this.enable = function () {
            _this.panel.alert = {};
            _this.initModel();
            _this.panel.alert.for = '5m'; //default value for new alerts. for existing alerts we use 0m to avoid breaking changes
        };
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.$scope.ctrl = this;
        this.subTabIndex = 0;
        this.evalFunctions = alertDef.evalFunctions;
        this.evalOperators = alertDef.evalOperators;
        this.conditionTypes = alertDef.conditionTypes;
        this.noDataModes = alertDef.noDataModes;
        this.executionErrorModes = alertDef.executionErrorModes;
        this.appSubUrl = config.appSubUrl;
        this.panelCtrl._enableAlert = this.enable;
        this.alertingMinIntervalSecs = config.alertingMinInterval;
        this.alertingMinInterval = rangeUtil.secondsToHms(config.alertingMinInterval);
    }
    AlertTabCtrl.prototype.$onInit = function () {
        var _this = this;
        this.addNotificationSegment = this.uiSegmentSrv.newPlusButton();
        // subscribe to graph threshold handle changes
        var thresholdChangedEventHandler = this.graphThresholdChanged.bind(this);
        this.panelCtrl.events.on(CoreEvents.thresholdChanged, thresholdChangedEventHandler);
        // set panel alert edit mode
        this.$scope.$on('$destroy', function () {
            _this.panelCtrl.events.off(CoreEvents.thresholdChanged, thresholdChangedEventHandler);
            _this.panelCtrl.editingThresholds = false;
            _this.panelCtrl.render();
        });
        // build notification model
        this.notifications = [];
        this.alertNotifications = [];
        this.alertHistory = [];
        return promiseToDigest(this.$scope)(getBackendSrv()
            .get('/api/alert-notifications/lookup')
            .then(function (res) {
            _this.notifications = res;
            _this.initModel();
            _this.validateModel();
        }));
    };
    AlertTabCtrl.prototype.getAlertHistory = function () {
        var _this = this;
        promiseToDigest(this.$scope)(getBackendSrv()
            .get("/api/annotations?dashboardId=" + this.panelCtrl.dashboard.id + "&panelId=" + this.panel.id + "&limit=50&type=alert")
            .then(function (res) {
            _this.alertHistory = map(res, function (ah) {
                var _a;
                ah.time = (_a = _this.dashboardSrv.getCurrent()) === null || _a === void 0 ? void 0 : _a.formatDate(ah.time, 'MMM D, YYYY HH:mm:ss');
                ah.stateModel = alertDef.getStateDisplayModel(ah.newState);
                ah.info = alertDef.getAlertAnnotationInfo(ah);
                return ah;
            });
        }));
    };
    AlertTabCtrl.prototype.getNotificationIcon = function (type) {
        switch (type) {
            case 'email':
                return 'envelope';
            case 'slack':
                return 'slack';
            case 'victorops':
                return 'fa fa-pagelines';
            case 'webhook':
                return 'cube';
            case 'pagerduty':
                return 'fa fa-bullhorn';
            case 'opsgenie':
                return 'bell';
            case 'hipchat':
                return 'fa fa-mail-forward';
            case 'pushover':
                return 'mobile-android';
            case 'kafka':
                return 'arrow-random';
            case 'teams':
                return 'fa fa-windows';
        }
        return 'bell';
    };
    AlertTabCtrl.prototype.getNotifications = function () {
        var _this = this;
        return Promise.resolve(this.notifications.map(function (item) {
            return _this.uiSegmentSrv.newSegment(item.name);
        }));
    };
    AlertTabCtrl.prototype.notificationAdded = function () {
        var model = find(this.notifications, {
            name: this.addNotificationSegment.value,
        });
        if (!model) {
            return;
        }
        this.alertNotifications.push({
            name: model.name,
            iconClass: this.getNotificationIcon(model.type),
            isDefault: false,
            uid: model.uid,
        });
        // avoid duplicates using both id and uid to be backwards compatible.
        if (!find(this.alert.notifications, function (n) { return n.id === model.id || n.uid === model.uid; })) {
            this.alert.notifications.push({ uid: model.uid });
        }
        // reset plus button
        this.addNotificationSegment.value = this.uiSegmentSrv.newPlusButton().value;
        this.addNotificationSegment.html = this.uiSegmentSrv.newPlusButton().html;
        this.addNotificationSegment.fake = true;
    };
    AlertTabCtrl.prototype.removeNotification = function (an) {
        // remove notifiers referred to by id and uid to support notifiers added
        // before and after we added support for uid
        remove(this.alert.notifications, function (n) { return n.uid === an.uid || n.id === an.id; });
        remove(this.alertNotifications, function (n) { return n.uid === an.uid || n.id === an.id; });
    };
    AlertTabCtrl.prototype.addAlertRuleTag = function () {
        if (this.newAlertRuleTag.name) {
            this.alert.alertRuleTags[this.newAlertRuleTag.name] = this.newAlertRuleTag.value;
        }
        this.newAlertRuleTag.name = '';
        this.newAlertRuleTag.value = '';
    };
    AlertTabCtrl.prototype.removeAlertRuleTag = function (tagName) {
        delete this.alert.alertRuleTags[tagName];
    };
    AlertTabCtrl.prototype.initModel = function () {
        var e_1, _a, e_2, _b;
        var _this = this;
        var alert = (this.alert = this.panel.alert);
        if (!alert) {
            return;
        }
        this.checkFrequency();
        alert.conditions = alert.conditions || [];
        if (alert.conditions.length === 0) {
            alert.conditions.push(getDefaultCondition());
        }
        alert.noDataState = alert.noDataState || config.alertingNoDataOrNullValues;
        alert.executionErrorState = alert.executionErrorState || config.alertingErrorOrTimeout;
        alert.frequency = alert.frequency || '1m';
        alert.handler = alert.handler || 1;
        alert.notifications = alert.notifications || [];
        alert.for = alert.for || '0m';
        alert.alertRuleTags = alert.alertRuleTags || {};
        var defaultName = this.panel.title + ' alert';
        alert.name = alert.name || defaultName;
        this.conditionModels = reduce(alert.conditions, function (memo, value) {
            memo.push(_this.buildConditionModel(value));
            return memo;
        }, []);
        ThresholdMapper.alertToGraphThresholds(this.panel);
        var _loop_1 = function (addedNotification) {
            var identifier = addedNotification.uid;
            // lookup notifier type by uid
            var model = find(this_1.notifications, { uid: identifier });
            // fallback using id if uid is missing
            if (!model && addedNotification.id) {
                identifier = addedNotification.id;
                model = find(this_1.notifications, { id: identifier });
            }
            if (!model) {
                appEvents.publish(new ShowConfirmModalEvent({
                    title: 'Notifier with invalid identifier is detected',
                    text: "Do you want to delete notifier with invalid identifier: " + identifier + " from the dashboard JSON?",
                    text2: 'After successful deletion, make sure to save the dashboard for storing the update JSON.',
                    icon: 'trash-alt',
                    confirmText: 'Delete',
                    yesText: 'Delete',
                    onConfirm: function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            this.removeNotification(addedNotification);
                            return [2 /*return*/];
                        });
                    }); },
                }));
            }
            if (model && model.isDefault === false) {
                model.iconClass = this_1.getNotificationIcon(model.type);
                this_1.alertNotifications.push(model);
            }
        };
        var this_1 = this;
        try {
            for (var _c = __values(alert.notifications), _d = _c.next(); !_d.done; _d = _c.next()) {
                var addedNotification = _d.value;
                _loop_1(addedNotification);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var _e = __values(this.notifications), _f = _e.next(); !_f.done; _f = _e.next()) {
                var notification = _f.value;
                if (notification.isDefault) {
                    notification.iconClass = this.getNotificationIcon(notification.type);
                    this.alertNotifications.push(notification);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
            }
            finally { if (e_2) throw e_2.error; }
        }
        this.panelCtrl.editingThresholds = true;
        this.panelCtrl.render();
    };
    AlertTabCtrl.prototype.checkFrequency = function () {
        this.frequencyWarning = '';
        if (!this.alert.frequency) {
            return;
        }
        if (!this.alert.frequency.match(/^\d+([dhms])$/)) {
            this.frequencyWarning =
                'Invalid frequency, has to be numeric followed by one of the following units: "d, h, m, s"';
            return;
        }
        try {
            var frequencySecs = rangeUtil.intervalToSeconds(this.alert.frequency);
            if (frequencySecs < this.alertingMinIntervalSecs) {
                this.frequencyWarning =
                    'A minimum evaluation interval of ' +
                        this.alertingMinInterval +
                        ' have been configured in Grafana and will be used for this alert rule. ' +
                        'Please contact the administrator to configure a lower interval.';
            }
        }
        catch (err) {
            this.frequencyWarning = err;
        }
    };
    AlertTabCtrl.prototype.graphThresholdChanged = function (evt) {
        var e_3, _a;
        try {
            for (var _b = __values(this.alert.conditions), _c = _b.next(); !_c.done; _c = _b.next()) {
                var condition = _c.value;
                if (condition.type === 'query') {
                    condition.evaluator.params[evt.handleIndex] = evt.threshold.value;
                    this.evaluatorParamsChanged();
                    break;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    AlertTabCtrl.prototype.validateModel = function () {
        var e_4, _a, e_5, _b;
        var _this = this;
        if (!this.alert) {
            return;
        }
        var firstTarget;
        var foundTarget = null;
        var promises = [];
        try {
            for (var _c = __values(this.alert.conditions), _d = _c.next(); !_d.done; _d = _c.next()) {
                var condition = _d.value;
                if (condition.type !== 'query') {
                    continue;
                }
                try {
                    for (var _e = (e_5 = void 0, __values(this.panel.targets)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var target = _f.value;
                        if (!firstTarget) {
                            firstTarget = target;
                        }
                        if (condition.query.params[0] === target.refId) {
                            foundTarget = target;
                            break;
                        }
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                if (!foundTarget) {
                    if (firstTarget) {
                        condition.query.params[0] = firstTarget.refId;
                        foundTarget = firstTarget;
                    }
                    else {
                        this.error = 'Could not find any metric queries';
                        return;
                    }
                }
                var datasourceName = foundTarget.datasource || this.panel.datasource;
                promises.push(this.datasourceSrv.get(datasourceName).then((function (foundTarget) { return function (ds) {
                    if (!ds.meta.alerting) {
                        return Promise.reject('The datasource does not support alerting queries');
                    }
                    else if (ds.targetContainsTemplate && ds.targetContainsTemplate(foundTarget)) {
                        return Promise.reject('Template variables are not supported in alert queries');
                    }
                    return Promise.resolve();
                }; })(foundTarget)));
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_4) throw e_4.error; }
        }
        Promise.all(promises).then(function () {
            _this.error = '';
            _this.$scope.$apply();
        }, function (e) {
            _this.error = e;
            _this.$scope.$apply();
        });
    };
    AlertTabCtrl.prototype.buildConditionModel = function (source) {
        var cm = { source: source, type: source.type };
        cm.queryPart = new QueryPart(source.query, alertDef.alertQueryDef);
        cm.reducerPart = alertDef.createReducerPart(source.reducer);
        cm.evaluator = source.evaluator;
        cm.operator = source.operator;
        return cm;
    };
    AlertTabCtrl.prototype.handleQueryPartEvent = function (conditionModel, evt) {
        var _this = this;
        switch (evt.name) {
            case 'action-remove-part': {
                break;
            }
            case 'get-part-actions': {
                return Promise.resolve([]);
            }
            case 'part-param-changed': {
                this.validateModel();
            }
            case 'get-param-options': {
                var result = this.panel.targets.map(function (target) {
                    return _this.uiSegmentSrv.newSegment({ value: target.refId });
                });
                return Promise.resolve(result);
            }
            default: {
                return Promise.resolve();
            }
        }
        return Promise.resolve();
    };
    AlertTabCtrl.prototype.handleReducerPartEvent = function (conditionModel, evt) {
        var e_6, _a;
        switch (evt.name) {
            case 'action': {
                conditionModel.source.reducer.type = evt.action.value;
                conditionModel.reducerPart = alertDef.createReducerPart(conditionModel.source.reducer);
                this.evaluatorParamsChanged();
                break;
            }
            case 'get-part-actions': {
                var result = [];
                try {
                    for (var _b = __values(alertDef.reducerTypes), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var type = _c.value;
                        if (type.value !== conditionModel.source.reducer.type) {
                            result.push(type);
                        }
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
                return Promise.resolve(result);
            }
        }
        return Promise.resolve();
    };
    AlertTabCtrl.prototype.addCondition = function (type) {
        var condition = getDefaultCondition();
        // add to persited model
        this.alert.conditions.push(condition);
        // add to view model
        this.conditionModels.push(this.buildConditionModel(condition));
    };
    AlertTabCtrl.prototype.removeCondition = function (index) {
        this.alert.conditions.splice(index, 1);
        this.conditionModels.splice(index, 1);
    };
    AlertTabCtrl.prototype.delete = function () {
        var _this = this;
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Delete Alert',
            text: 'Are you sure you want to delete this alert rule?',
            text2: 'You need to save dashboard for the delete to take effect',
            icon: 'trash-alt',
            yesText: 'Delete',
            onConfirm: function () {
                delete _this.panel.alert;
                _this.alert = null;
                _this.panel.thresholds = [];
                _this.conditionModels = [];
                _this.panelCtrl.alertState = null;
                _this.panelCtrl.render();
            },
        }));
    };
    AlertTabCtrl.prototype.evaluatorParamsChanged = function () {
        ThresholdMapper.alertToGraphThresholds(this.panel);
        this.panelCtrl.render();
    };
    AlertTabCtrl.prototype.evaluatorTypeChanged = function (evaluator) {
        // ensure params array is correct length
        switch (evaluator.type) {
            case 'lt':
            case 'gt': {
                evaluator.params = [evaluator.params[0]];
                break;
            }
            case 'within_range':
            case 'outside_range': {
                evaluator.params = [evaluator.params[0], evaluator.params[1]];
                break;
            }
            case 'no_value': {
                evaluator.params = [];
            }
        }
        this.evaluatorParamsChanged();
    };
    AlertTabCtrl.prototype.clearHistory = function () {
        var _this = this;
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Delete Alert History',
            text: 'Are you sure you want to remove all history & annotations for this alert?',
            icon: 'trash-alt',
            yesText: 'Yes',
            onConfirm: function () {
                promiseToDigest(_this.$scope)(getBackendSrv()
                    .post('/api/annotations/mass-delete', {
                    dashboardId: _this.panelCtrl.dashboard.id,
                    panelId: _this.panel.id,
                })
                    .then(function () {
                    _this.alertHistory = [];
                    _this.panelCtrl.refresh();
                }));
            },
        }));
    };
    return AlertTabCtrl;
}());
export { AlertTabCtrl };
/** @ngInject */
export function alertTab() {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/app/features/alerting/partials/alert_tab.html',
        controller: AlertTabCtrl,
    };
}
coreModule.directive('alertTab', alertTab);
//# sourceMappingURL=AlertTabCtrl.js.map