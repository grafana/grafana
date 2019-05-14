import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
var UtilSrv = /** @class */ (function () {
    /** @ngInject */
    function UtilSrv($rootScope, $modal) {
        this.$rootScope = $rootScope;
        this.$modal = $modal;
    }
    UtilSrv.prototype.init = function () {
        appEvents.on('show-modal', this.showModal.bind(this), this.$rootScope);
        appEvents.on('hide-modal', this.hideModal.bind(this), this.$rootScope);
        appEvents.on('confirm-modal', this.showConfirmModal.bind(this), this.$rootScope);
    };
    UtilSrv.prototype.hideModal = function () {
        if (this.modalScope && this.modalScope.dismiss) {
            this.modalScope.dismiss();
        }
    };
    UtilSrv.prototype.showModal = function (options) {
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
        var scope = this.$rootScope.$new();
        scope.onConfirm = function () {
            payload.onConfirm();
            scope.dismiss();
        };
        scope.updateConfirmText = function (value) {
            scope.confirmTextValid = payload.confirmText.toLowerCase() === value.toLowerCase();
        };
        scope.title = payload.title;
        scope.text = payload.text;
        scope.text2 = payload.text2;
        scope.confirmText = payload.confirmText;
        scope.onConfirm = payload.onConfirm;
        scope.onAltAction = payload.onAltAction;
        scope.altActionText = payload.altActionText;
        scope.icon = payload.icon || 'fa-check';
        scope.yesText = payload.yesText || 'Yes';
        scope.noText = payload.noText || 'Cancel';
        scope.confirmTextValid = scope.confirmText ? false : true;
        appEvents.emit('show-modal', {
            src: 'public/app/partials/confirm_modal.html',
            scope: scope,
            modalClass: 'confirm-modal',
        });
    };
    return UtilSrv;
}());
export { UtilSrv };
coreModule.service('utilSrv', UtilSrv);
//# sourceMappingURL=util_srv.js.map