import angular from 'angular';
import { each } from 'lodash';
import { PanelEvents } from '@grafana/data';
import coreModule from 'app/angular/core_module';
import config from 'app/core/config';
import { importPanelPlugin } from '../../features/plugins/importPanelPlugin';
import { importDataSourcePlugin, importAppPlugin } from '../../features/plugins/plugin_loader';
coreModule.directive('pluginComponent', ['$compile', '$http', '$templateCache', '$location', pluginDirectiveLoader]);
function pluginDirectiveLoader($compile, $http, $templateCache, $location) {
    function getTemplate(component) {
        if (component.template) {
            return Promise.resolve(component.template);
        }
        const cached = $templateCache.get(component.templateUrl);
        if (cached) {
            return Promise.resolve(cached);
        }
        return $http.get(component.templateUrl).then((res) => {
            return res.data;
        });
    }
    function relativeTemplateUrlToAbs(templateUrl, baseUrl) {
        if (!templateUrl) {
            return undefined;
        }
        if (templateUrl.indexOf('public') === 0) {
            return templateUrl;
        }
        return baseUrl + '/' + templateUrl;
    }
    function getPluginComponentDirective(options) {
        // handle relative template urls for plugin templates
        options.Component.templateUrl = relativeTemplateUrlToAbs(options.Component.templateUrl, options.baseUrl);
        return () => {
            return {
                templateUrl: options.Component.templateUrl,
                template: options.Component.template,
                restrict: 'E',
                controller: options.Component,
                controllerAs: 'ctrl',
                bindToController: true,
                scope: options.bindings,
                link: (scope, elem, attrs, ctrl) => {
                    if (ctrl.link) {
                        ctrl.link(scope, elem, attrs, ctrl);
                    }
                    if (ctrl.init) {
                        ctrl.init();
                    }
                },
            };
        };
    }
    function loadPanelComponentInfo(scope, attrs) {
        const componentInfo = {
            name: 'panel-plugin-' + scope.panel.type,
            bindings: { dashboard: '=', panel: '=', row: '=' },
            attrs: {
                dashboard: 'dashboard',
                panel: 'panel',
                class: 'panel-height-helper',
            },
        };
        const panelInfo = config.panels[scope.panel.type];
        return importPanelPlugin(panelInfo.id).then((panelPlugin) => {
            const PanelCtrl = panelPlugin.angularPanelCtrl;
            componentInfo.Component = PanelCtrl;
            if (!PanelCtrl || PanelCtrl.registered) {
                return componentInfo;
            }
            if (PanelCtrl.templatePromise) {
                return PanelCtrl.templatePromise.then((res) => {
                    return componentInfo;
                });
            }
            if (panelInfo) {
                PanelCtrl.templateUrl = relativeTemplateUrlToAbs(PanelCtrl.templateUrl, panelInfo.baseUrl);
            }
            PanelCtrl.templatePromise = getTemplate(PanelCtrl).then((template) => {
                PanelCtrl.templateUrl = null;
                PanelCtrl.template = `<grafana-panel ctrl="ctrl" class="panel-height-helper">${template}</grafana-panel>`;
                return Object.assign(Object.assign({}, componentInfo), { baseUrl: panelInfo.baseUrl });
            });
            return PanelCtrl.templatePromise;
        });
    }
    function getModule(scope, attrs) {
        switch (attrs.type) {
            // QueryCtrl
            case 'query-ctrl': {
                const ds = scope.ctrl.datasource;
                return Promise.resolve({
                    baseUrl: ds.meta.baseUrl,
                    name: 'query-ctrl-' + ds.meta.id,
                    bindings: { target: '=', panelCtrl: '=', datasource: '=' },
                    attrs: {
                        target: 'ctrl.target',
                        'panel-ctrl': 'ctrl',
                        datasource: 'ctrl.datasource',
                    },
                    Component: ds.components.QueryCtrl,
                });
            }
            // Annotations
            case 'annotations-query-ctrl': {
                const baseUrl = scope.ctrl.currentDatasource.meta.baseUrl;
                const pluginId = scope.ctrl.currentDatasource.meta.id;
                return importDataSourcePlugin(scope.ctrl.currentDatasource.meta).then((dsPlugin) => {
                    return {
                        baseUrl,
                        name: 'annotations-query-ctrl-' + pluginId,
                        bindings: { annotation: '=', datasource: '=' },
                        attrs: {
                            annotation: 'ctrl.currentAnnotation',
                            datasource: 'ctrl.currentDatasource',
                        },
                        Component: dsPlugin.components.AnnotationsQueryCtrl,
                    };
                });
            }
            // Datasource ConfigCtrl
            case 'datasource-config-ctrl': {
                const dsMeta = scope.ctrl.datasourceMeta;
                const angularUrl = $location.url();
                return importDataSourcePlugin(dsMeta).then((dsPlugin) => {
                    scope.$watch('ctrl.current', () => {
                        // This watcher can trigger when we navigate away due to late digests
                        // This check is to stop onModelChanged from being called when navigating away
                        // as it triggers a redux action which comes before the angular $routeChangeSucces and
                        // This makes the bridgeSrv think location changed from redux before detecting it was actually
                        // changed from angular.
                        if (angularUrl === $location.url()) {
                            scope.onModelChanged(scope.ctrl.current);
                        }
                    }, true);
                    return {
                        baseUrl: dsMeta.baseUrl,
                        name: 'ds-config-' + dsMeta.id,
                        bindings: { meta: '=', current: '=' },
                        attrs: { meta: 'ctrl.datasourceMeta', current: 'ctrl.current' },
                        Component: dsPlugin.angularConfigCtrl,
                    };
                });
            }
            // AppConfigCtrl
            case 'app-config-ctrl': {
                const model = scope.ctrl.model;
                return importAppPlugin(model).then((appPlugin) => {
                    return {
                        baseUrl: model.baseUrl,
                        name: 'app-config-' + model.id,
                        bindings: { appModel: '=', appEditCtrl: '=' },
                        attrs: { 'app-model': 'ctrl.model', 'app-edit-ctrl': 'ctrl' },
                        Component: appPlugin.angularConfigCtrl,
                    };
                });
            }
            // Panel
            case 'panel': {
                return loadPanelComponentInfo(scope, attrs);
            }
            default: {
                return Promise.reject({
                    message: 'Could not find component type: ' + attrs.type,
                });
            }
        }
    }
    function appendAndCompile(scope, elem, componentInfo) {
        const child = angular.element(document.createElement(componentInfo.name));
        each(componentInfo.attrs, (value, key) => {
            child.attr(key, value);
        });
        $compile(child)(scope);
        elem.empty();
        // let a binding digest cycle complete before adding to dom
        setTimeout(() => {
            scope.$applyAsync(() => {
                elem.append(child);
                setTimeout(() => {
                    scope.$applyAsync(() => {
                        scope.$broadcast(PanelEvents.componentDidMount.name);
                    });
                });
            });
        });
    }
    function registerPluginComponent(scope, elem, attrs, componentInfo) {
        if (componentInfo.notFound) {
            elem.empty();
            return;
        }
        if (!componentInfo.Component) {
            throw {
                message: 'Failed to find exported plugin component for ' + componentInfo.name,
            };
        }
        if (!componentInfo.Component.registered) {
            const directiveName = attrs.$normalize(componentInfo.name);
            const directiveFn = getPluginComponentDirective(componentInfo);
            coreModule.directive(directiveName, directiveFn);
            componentInfo.Component.registered = true;
        }
        appendAndCompile(scope, elem, componentInfo);
    }
    return {
        restrict: 'E',
        link: (scope, elem, attrs) => {
            getModule(scope, attrs)
                .then((componentInfo) => {
                registerPluginComponent(scope, elem, attrs, componentInfo);
            })
                .catch((err) => {
                console.error('Plugin component error', err);
            });
        },
    };
}
//# sourceMappingURL=plugin_component.js.map