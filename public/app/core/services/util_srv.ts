import React from 'react';
import ReactDOM from 'react-dom';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

import { AngularModalProxy } from '../components/modals/AngularModalProxy';
import { provideTheme } from '../utils/ConfigProvider';
import {
  HideModalReactEvent,
  ShowConfirmModalEvent,
  ShowConfirmModalPayload,
  ShowModalReactEvent,
} from '../../types/events';
import { ConfirmModal, ConfirmModalProps } from '@grafana/ui';
import { textUtil } from '@grafana/data';

export class UtilSrv {
  modalScope: any;
  reactModalRoot = document.body;
  reactModalNode = document.createElement('div');

  constructor() {
    this.reactModalNode.setAttribute('id', 'angular2ReactModalRoot');
  }

  init() {
    appEvents.subscribe(ShowConfirmModalEvent, (e) => this.showConfirmModal(e.payload));
    appEvents.subscribe(ShowModalReactEvent, (e) => this.showModalReact(e.payload));
    appEvents.subscribe(HideModalReactEvent, this.onReactModalDismiss);
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
