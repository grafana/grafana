import React from 'react';
import ReactDOM from 'react-dom';
import { selectors } from '@grafana/e2e-selectors';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { AngularModalProxy } from '../components/modals/AngularModalProxy';
import { provideTheme } from '../utils/ConfigProvider';

export class UtilSrv {
  modalScope: any;
  reactModalRoot = document.body;
  reactModalNode = document.createElement('div');

  /** @ngInject */
  constructor(private $rootScope: GrafanaRootScope, private $modal: any) {
    this.reactModalNode.setAttribute('id', 'angular2ReactModalRoot');
  }

  init() {
    appEvents.on(CoreEvents.showModal, this.showModal.bind(this), this.$rootScope);
    appEvents.on(CoreEvents.hideModal, this.hideModal.bind(this), this.$rootScope);
    appEvents.on(CoreEvents.showConfirmModal, this.showConfirmModal.bind(this), this.$rootScope);
    appEvents.on(CoreEvents.showModalReact, this.showModalReact.bind(this), this.$rootScope);
  }

  showModalReact(options: any) {
    const { component, props } = options;
    const modalProps = {
      component,
      props: {
        ...props,
        isOpen: true,
        onDismiss: this.onReactModalDismiss,
      },
    };

    const elem = React.createElement(provideTheme(AngularModalProxy), modalProps);
    this.reactModalRoot.appendChild(this.reactModalNode);
    return ReactDOM.render(elem, this.reactModalNode);
  }

  onReactModalDismiss = () => {
    ReactDOM.unmountComponentAtNode(this.reactModalNode);
    this.reactModalRoot.removeChild(this.reactModalNode);
  };

  hideModal() {
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }
  }

  showModal(options: any) {
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }

    this.modalScope = options.scope;

    if (options.model) {
      this.modalScope = this.$rootScope.$new();
      this.modalScope.model = options.model;
    } else if (!this.modalScope) {
      this.modalScope = this.$rootScope.$new();
    }

    const modal = this.$modal({
      modalClass: options.modalClass,
      template: options.src,
      templateHtml: options.templateHtml,
      persist: false,
      show: false,
      scope: this.modalScope,
      keyboard: false,
      backdrop: options.backdrop,
    });

    Promise.resolve(modal).then(modalEl => {
      modalEl.modal('show');
    });
  }

  showConfirmModal(payload: any) {
    const scope: any = this.$rootScope.$new();

    scope.updateConfirmText = (value: any) => {
      scope.confirmTextValid = payload.confirmText.toLowerCase() === value.toLowerCase();
    };

    scope.title = payload.title;
    scope.text = payload.text;
    scope.text2 = payload.text2;
    scope.text2htmlBind = payload.text2htmlBind;
    scope.confirmText = payload.confirmText;

    scope.onConfirm = payload.onConfirm;
    scope.onAltAction = payload.onAltAction;
    scope.altActionText = payload.altActionText;
    scope.icon = payload.icon || 'check';
    scope.yesText = payload.yesText || 'Yes';
    scope.noText = payload.noText || 'Cancel';
    scope.confirmTextValid = scope.confirmText ? false : true;
    scope.selectors = selectors.pages.ConfirmModal;

    appEvents.emit(CoreEvents.showModal, {
      src: 'public/app/partials/confirm_modal.html',
      scope: scope,
      modalClass: 'confirm-modal',
    });
  }
}

coreModule.service('utilSrv', UtilSrv);
