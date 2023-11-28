import React from 'react';
import { getAngularLoader } from '@grafana/runtime';
export class AngularEditorLoader extends React.PureComponent {
    constructor() {
        super(...arguments);
        this.ref = null;
    }
    componentWillUnmount() {
        if (this.angularComponent) {
            this.angularComponent.destroy();
        }
    }
    componentDidMount() {
        if (this.ref) {
            this.loadAngular();
        }
    }
    componentDidUpdate(prevProps) {
        var _a;
        if (prevProps.datasource !== this.props.datasource) {
            this.loadAngular();
        }
        if (this.scopeProps && this.scopeProps.ctrl.currentAnnotation !== this.props.annotation) {
            this.scopeProps.ctrl.ignoreNextWatcherFiring = true;
            this.scopeProps.ctrl.currentAnnotation = this.props.annotation;
            (_a = this.angularComponent) === null || _a === void 0 ? void 0 : _a.digest();
        }
    }
    loadAngular() {
        if (this.angularComponent) {
            this.angularComponent.destroy();
            this.scopeProps = undefined;
        }
        const loader = getAngularLoader();
        // NOTE: BE CAREFUL HERE
        // If this template contains an ng-if, then it won't be removed correctly by AngularLoader.
        // The compiledElem will only contain the single comment node (e.g. <!-- ngIf !ctrl.currentDatasource.annotations -->)
        const template = `<plugin-component type="annotations-query-ctrl"> </plugin-component>`;
        const scopeProps = {
            ctrl: {
                currentDatasource: this.props.datasource,
                currentAnnotation: this.props.annotation,
                ignoreNextWatcherFiring: false,
            },
        };
        this.angularComponent = loader.load(this.ref, scopeProps, template);
        this.angularComponent.digest();
        this.angularComponent.getScope().$watch(() => {
            // To avoid recursive loop when the annotation is updated from outside angular in componentDidUpdate
            if (scopeProps.ctrl.ignoreNextWatcherFiring) {
                scopeProps.ctrl.ignoreNextWatcherFiring = false;
                return;
            }
            this.props.onChange(scopeProps.ctrl.currentAnnotation);
        });
        this.scopeProps = scopeProps;
    }
    render() {
        return React.createElement("div", { ref: (element) => (this.ref = element) });
    }
}
//# sourceMappingURL=AngularEditorLoader.js.map