import React from 'react';
import ReactDOM from 'react-dom';

import coreModule from 'app/angular/core_module';
import appEvents from 'app/core/app_events';

import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { AngularModalProxy } from '../components/modals/AngularModalProxy';
import { provideTheme } from '../utils/ConfigProvider';
import {
  HideModalEvent,
  ShowConfirmModalEvent,
  ShowConfirmModalPayload,
  ShowModalEvent,
  ShowModalReactEvent,
} from '../../types/events';
import { ConfirmModal, ConfirmModalProps } from '@grafana/ui';
import { deprecationWarning, textUtil } from '@grafana/data';
import { CopyPanelEvent } from '@grafana/runtime';
import { copyPanel } from 'app/features/dashboard/utils/panel';

export class UtilSrv {
  modalScope: any;
  reactModalRoot = document.body;
  reactModalNode = document.createElement('div');

  /** @ngInject */
  constructor(private $rootScope: GrafanaRootScope, private $modal: any) {
    this.reactModalNode.setAttribute('id', 'angular2ReactModalRoot');
  }

  init() {
    appEvents.subscribe(ShowModalEvent, (e) => this.showModal(e.payload));
    appEvents.subscribe(HideModalEvent, this.hideModal.bind(this));
    appEvents.subscribe(ShowConfirmModalEvent, (e) => this.showConfirmModal(e.payload));
    appEvents.subscribe(ShowModalReactEvent, (e) => this.showModalReact(e.payload));
    appEvents.subscribe(CopyPanelEvent, (e) => copyPanel(e.payload));
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
    ReactDOM.render(elem, this.reactModalNode);
  }

  onReactModalDismiss = () => {
    ReactDOM.unmountComponentAtNode(this.reactModalNode);
    this.reactModalRoot.removeChild(this.reactModalNode);
  };

  /**
   * @deprecated use showModalReact instead that has this capability built in
   */
  hideModal() {
    deprecationWarning('UtilSrv', 'hideModal', 'showModalReact');
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }
  }

  /**
   * @deprecated use showModalReact instead
   */
  showModal(options: any) {
    deprecationWarning('UtilSrv', 'showModal', 'showModalReact');
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

    Promise.resolve(modal).then((modalEl) => {
      modalEl.modal('show');
    });
  }

  showConfirmModal(payload: ShowConfirmModalPayload) {
    const {
      confirmText,
      onConfirm = () => undefined,
      text2,
      altActionText,
      onAltAction,
      noText,
      text,
      text2htmlBind,
      yesText = 'Yes',
      icon,
      title = 'Confirm',
    } = payload;
    const props: ConfirmModalProps = {
      confirmText: yesText,
      confirmationText: confirmText,
      icon,
      title,
      body: text,
      description: text2 && text2htmlBind ? textUtil.sanitize(text2) : text2,
      isOpen: true,
      dismissText: noText,
      onConfirm: () => {
        onConfirm();
        this.onReactModalDismiss();
      },
      onDismiss: this.onReactModalDismiss,
      onAlternative: onAltAction
        ? () => {
            onAltAction();
            this.onReactModalDismiss();
          }
        : undefined,
      alternativeText: altActionText,
    };
    const modalProps = {
      component: ConfirmModal,
      props,
    };

    const elem = React.createElement(provideTheme(AngularModalProxy), modalProps);
    this.reactModalRoot.appendChild(this.reactModalNode);
    ReactDOM.render(elem, this.reactModalNode);
  }
}

coreModule.service('utilSrv', UtilSrv);
