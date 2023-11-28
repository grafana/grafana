import React from 'react';
import { createRoot } from 'react-dom/client';
import { textUtil } from '@grafana/data';
import { config, CopyPanelEvent } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { copyPanel } from 'app/features/dashboard/utils/panel';
import { ShowConfirmModalEvent, ShowModalReactEvent, } from '../../types/events';
import { AngularModalProxy } from '../components/modals/AngularModalProxy';
import { provideTheme } from '../utils/ConfigProvider';
export class ModalManager {
    constructor() {
        this.reactModalRoot = document.body;
        this.reactModalNode = document.createElement('div');
        this.root = createRoot(this.reactModalNode);
        this.onReactModalDismiss = () => {
            this.root.render(null);
            this.reactModalRoot.removeChild(this.reactModalNode);
        };
    }
    init() {
        appEvents.subscribe(ShowConfirmModalEvent, (e) => this.showConfirmModal(e.payload));
        appEvents.subscribe(ShowModalReactEvent, (e) => this.showModalReact(e.payload));
        appEvents.subscribe(CopyPanelEvent, (e) => copyPanel(e.payload));
    }
    showModalReact(options) {
        const { component, props } = options;
        const modalProps = {
            component,
            props: Object.assign(Object.assign({}, props), { isOpen: true, onDismiss: this.onReactModalDismiss }),
        };
        const elem = React.createElement(provideTheme(AngularModalProxy, config.theme2), modalProps);
        this.reactModalRoot.appendChild(this.reactModalNode);
        this.root.render(elem);
    }
    showConfirmModal(payload) {
        const { confirmText, onConfirm = () => undefined, onDismiss, text2, altActionText, onAltAction, noText, text, text2htmlBind, yesText = 'Yes', icon, title = 'Confirm', yesButtonVariant, } = payload;
        const props = {
            confirmText: yesText,
            confirmButtonVariant: yesButtonVariant,
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
            onDismiss: () => {
                onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss();
                this.onReactModalDismiss();
            },
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
        const elem = React.createElement(provideTheme(AngularModalProxy, config.theme2), modalProps);
        this.reactModalRoot.appendChild(this.reactModalNode);
        this.root.render(elem);
    }
}
//# sourceMappingURL=ModalManager.js.map