import { __assign } from "tslib";
import React from 'react';
import ReactDOM from 'react-dom';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { AngularModalProxy } from '../components/modals/AngularModalProxy';
import { provideTheme } from '../utils/ConfigProvider';
import { HideModalEvent, ShowConfirmModalEvent, ShowModalEvent, ShowModalReactEvent, } from '../../types/events';
import { ConfirmModal } from '@grafana/ui';
import { deprecationWarning, textUtil } from '@grafana/data';
import { CopyPanelEvent } from '@grafana/runtime';
import { copyPanel } from 'app/features/dashboard/utils/panel';
var UtilSrv = /** @class */ (function () {
    /** @ngInject */
    function UtilSrv($rootScope, $modal) {
        var _this = this;
        this.$rootScope = $rootScope;
        this.$modal = $modal;
        this.reactModalRoot = document.body;
        this.reactModalNode = document.createElement('div');
        this.onReactModalDismiss = function () {
            ReactDOM.unmountComponentAtNode(_this.reactModalNode);
            _this.reactModalRoot.removeChild(_this.reactModalNode);
        };
        this.reactModalNode.setAttribute('id', 'angular2ReactModalRoot');
    }
    UtilSrv.prototype.init = function () {
        var _this = this;
        appEvents.subscribe(ShowModalEvent, function (e) { return _this.showModal(e.payload); });
        appEvents.subscribe(HideModalEvent, this.hideModal.bind(this));
        appEvents.subscribe(ShowConfirmModalEvent, function (e) { return _this.showConfirmModal(e.payload); });
        appEvents.subscribe(ShowModalReactEvent, function (e) { return _this.showModalReact(e.payload); });
        appEvents.subscribe(CopyPanelEvent, function (e) { return copyPanel(e.payload); });
    };
    UtilSrv.prototype.showModalReact = function (options) {
        var component = options.component, props = options.props;
        var modalProps = {
            component: component,
            props: __assign(__assign({}, props), { isOpen: true, onDismiss: this.onReactModalDismiss }),
        };
        var elem = React.createElement(provideTheme(AngularModalProxy), modalProps);
        this.reactModalRoot.appendChild(this.reactModalNode);
        ReactDOM.render(elem, this.reactModalNode);
    };
    /**
     * @deprecated use showModalReact instead that has this capability built in
     */
    UtilSrv.prototype.hideModal = function () {
        deprecationWarning('UtilSrv', 'hideModal', 'showModalReact');
        if (this.modalScope && this.modalScope.dismiss) {
            this.modalScope.dismiss();
        }
    };
    /**
     * @deprecated use showModalReact instead
     */
    UtilSrv.prototype.showModal = function (options) {
        deprecationWarning('UtilSrv', 'showModal', 'showModalReact');
        if (this.modalScope && this.modalScope.dismiss) {
            this.modalScope.dismiss();
        }
        this.modalScope = options.scope;
        if (options.model) {
            this.modalScope = this.$rootScope.$new();
            this.modalScope.model = options.model;
        }
        else if (!this.modalScope) {
            this.modalScope = this.$rootScope.$new();
        }
        var modal = this.$modal({
            modalClass: options.modalClass,
            template: options.src,
            templateHtml: options.templateHtml,
            persist: false,
            show: false,
            scope: this.modalScope,
            keyboard: false,
            backdrop: options.backdrop,
        });
        Promise.resolve(modal).then(function (modalEl) {
            modalEl.modal('show');
        });
    };
    UtilSrv.prototype.showConfirmModal = function (payload) {
        var _this = this;
        var confirmText = payload.confirmText, _a = payload.onConfirm, onConfirm = _a === void 0 ? function () { return undefined; } : _a, text2 = payload.text2, altActionText = payload.altActionText, onAltAction = payload.onAltAction, noText = payload.noText, text = payload.text, text2htmlBind = payload.text2htmlBind, _b = payload.yesText, yesText = _b === void 0 ? 'Yes' : _b, icon = payload.icon, _c = payload.title, title = _c === void 0 ? 'Confirm' : _c;
        var props = {
            confirmText: yesText,
            confirmationText: confirmText,
            icon: icon,
            title: title,
            body: text,
            description: text2 && text2htmlBind ? textUtil.sanitize(text2) : text2,
            isOpen: true,
            dismissText: noText,
            onConfirm: function () {
                onConfirm();
                _this.onReactModalDismiss();
            },
            onDismiss: this.onReactModalDismiss,
            onAlternative: onAltAction
                ? function () {
                    onAltAction();
                    _this.onReactModalDismiss();
                }
                : undefined,
            alternativeText: altActionText,
        };
        var modalProps = {
            component: ConfirmModal,
            props: props,
        };
        var elem = React.createElement(provideTheme(AngularModalProxy), modalProps);
        this.reactModalRoot.appendChild(this.reactModalNode);
        ReactDOM.render(elem, this.reactModalNode);
    };
    return UtilSrv;
}());
export { UtilSrv };
coreModule.service('utilSrv', UtilSrv);
//# sourceMappingURL=util_srv.js.map