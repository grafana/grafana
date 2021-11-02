import { __awaiter, __generator } from "tslib";
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import store from 'app/core/store';
var step1TutorialTitle = 'Grafana fundamentals';
var step2TutorialTitle = 'Create users and teams';
var keyPrefix = 'getting.started.';
var step1Key = "" + keyPrefix + step1TutorialTitle.replace(' ', '-').trim().toLowerCase();
var step2Key = "" + keyPrefix + step2TutorialTitle.replace(' ', '-').trim().toLowerCase();
export var getSteps = function () { return [
    {
        heading: 'Welcome to Grafana',
        subheading: 'The steps below will guide you to quickly finish setting up your Grafana installation.',
        title: 'Basic',
        info: 'The steps below will guide you to quickly finish setting up your Grafana installation.',
        done: false,
        cards: [
            {
                type: 'tutorial',
                heading: 'Data source and dashboards',
                title: step1TutorialTitle,
                info: 'Set up and understand Grafana if you have no prior experience. This tutorial guides you through the entire process and covers the “Data source” and “Dashboards” steps to the right.',
                href: 'https://grafana.com/tutorials/grafana-fundamentals',
                icon: 'grafana',
                check: function () { return Promise.resolve(store.get(step1Key)); },
                key: step1Key,
                done: false,
            },
            {
                type: 'docs',
                title: 'Add your first data source',
                heading: 'data sources',
                icon: 'database',
                learnHref: 'https://grafana.com/docs/grafana/latest/features/datasources/add-a-data-source',
                href: 'datasources/new',
                check: function () {
                    return new Promise(function (resolve) {
                        resolve(getDatasourceSrv()
                            .getMetricSources()
                            .filter(function (item) {
                            return item.meta.builtIn !== true;
                        }).length > 0);
                    });
                },
                done: false,
            },
            {
                type: 'docs',
                heading: 'dashboards',
                title: 'Create your first dashboard',
                icon: 'apps',
                href: 'dashboard/new',
                learnHref: 'https://grafana.com/docs/grafana/latest/guides/getting_started/#create-a-dashboard',
                check: function () { return __awaiter(void 0, void 0, void 0, function () {
                    var result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, getBackendSrv().search({ limit: 1 })];
                            case 1:
                                result = _a.sent();
                                return [2 /*return*/, result.length > 0];
                        }
                    });
                }); },
                done: false,
            },
        ],
    },
    {
        heading: 'Setup complete!',
        subheading: 'All necessary steps to use Grafana are done. Now tackle advanced steps or make the best use of this home dashboard – it is, after all, a fully customizable dashboard – and remove this panel.',
        title: 'Advanced',
        info: ' Manage your users and teams and add plugins. These steps are optional',
        done: false,
        cards: [
            {
                type: 'tutorial',
                heading: 'Users',
                title: 'Create users and teams',
                info: 'Learn to organize your users in teams and manage resource access and roles.',
                href: 'https://grafana.com/tutorials/create-users-and-teams',
                icon: 'users-alt',
                key: step2Key,
                check: function () { return Promise.resolve(store.get(step2Key)); },
                done: false,
            },
            {
                type: 'docs',
                heading: 'plugins',
                title: 'Find and install plugins',
                learnHref: 'https://grafana.com/docs/grafana/latest/plugins/installation',
                href: 'plugins',
                icon: 'plug',
                check: function () { return __awaiter(void 0, void 0, void 0, function () {
                    var plugins;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, getBackendSrv().get('/api/plugins', { embedded: 0, core: 0 })];
                            case 1:
                                plugins = _a.sent();
                                return [2 /*return*/, Promise.resolve(plugins.length > 0)];
                        }
                    });
                }); },
                done: false,
            },
        ],
    },
]; };
//# sourceMappingURL=steps.js.map