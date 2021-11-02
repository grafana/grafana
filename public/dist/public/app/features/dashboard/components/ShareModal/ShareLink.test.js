import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { setTemplateSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { ShareLink } from './ShareLink';
import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';
import { variableAdapters } from '../../../variables/adapters';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';
import { PanelModel } from '../../state';
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: function () { return ({
        timeRange: function () {
            return { from: new Date(1000), to: new Date(2000) };
        },
    }); },
}); });
function mockLocationHref(href) {
    var location = window.location;
    var search = '';
    var searchPos = href.indexOf('?');
    if (searchPos >= 0) {
        search = href.substring(searchPos);
    }
    //@ts-ignore
    delete window.location;
    window.location = __assign(__assign({}, location), { href: href, search: search });
}
function setUTCTimeZone() {
    window.Intl.DateTimeFormat = function () {
        return {
            resolvedOptions: function () {
                return { timeZone: 'UTC' };
            },
        };
    };
}
var mockUid = 'abc123';
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { getBackendSrv: function () { return ({
            post: jest.fn().mockResolvedValue({
                uid: mockUid,
                url: "http://localhost:3000/goto/" + mockUid,
            }),
        }); } });
});
function shareLinkScenario(description, scenarioFn) {
    describe(description, function () {
        var setupFn;
        var ctx = {
            setup: function (fn) {
                setupFn = fn;
            },
            mount: function (propOverrides) {
                var props = {
                    panel: undefined,
                };
                Object.assign(props, propOverrides);
                ctx.wrapper = shallow(React.createElement(ShareLink, __assign({}, props)));
            },
        };
        beforeEach(function () {
            setUTCTimeZone();
            setupFn();
        });
        scenarioFn(ctx);
    });
}
describe('ShareModal', function () {
    var templateSrv = initTemplateSrv([]);
    beforeAll(function () {
        variableAdapters.register(createQueryVariableAdapter());
        setTemplateSrv(templateSrv);
    });
    shareLinkScenario('shareUrl with current time range and panel', function (ctx) {
        ctx.setup(function () {
            mockLocationHref('http://server/#!/test');
            config.bootData = {
                user: {
                    orgId: 1,
                },
            };
            ctx.mount({
                panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
            });
        });
        it('should generate share url absolute time', function () { return __awaiter(void 0, void 0, void 0, function () {
            var state;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, ((_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.instance().buildUrl())];
                    case 1:
                        _c.sent();
                        state = (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.state();
                        expect(state === null || state === void 0 ? void 0 : state.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&viewPanel=22');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate render url', function () { return __awaiter(void 0, void 0, void 0, function () {
            var state, base, params;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        mockLocationHref('http://dashboards.grafana.com/d/abcdefghi/my-dash');
                        ctx.mount({
                            panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
                        });
                        return [4 /*yield*/, ((_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.instance().buildUrl())];
                    case 1:
                        _c.sent();
                        state = (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.state();
                        base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
                        params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
                        expect(state === null || state === void 0 ? void 0 : state.imageUrl).toContain(base + params);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate render url for scripted dashboard', function () { return __awaiter(void 0, void 0, void 0, function () {
            var state, base, params;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        mockLocationHref('http://dashboards.grafana.com/dashboard/script/my-dash.js');
                        ctx.mount({
                            panel: new PanelModel({ id: 22, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
                        });
                        return [4 /*yield*/, ((_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.instance().buildUrl())];
                    case 1:
                        _c.sent();
                        state = (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.state();
                        base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
                        params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
                        expect(state === null || state === void 0 ? void 0 : state.imageUrl).toContain(base + params);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should remove panel id when no panel in scope', function () { return __awaiter(void 0, void 0, void 0, function () {
            var state;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        ctx.mount({
                            panel: undefined,
                        });
                        return [4 /*yield*/, ((_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.instance().buildUrl())];
                    case 1:
                        _c.sent();
                        state = (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.state();
                        expect(state === null || state === void 0 ? void 0 : state.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should add theme when specified', function () { return __awaiter(void 0, void 0, void 0, function () {
            var state;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        (_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.setProps({ panel: undefined });
                        (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.setState({ selectedTheme: 'light' });
                        return [4 /*yield*/, ((_c = ctx.wrapper) === null || _c === void 0 ? void 0 : _c.instance().buildUrl())];
                    case 1:
                        _e.sent();
                        state = (_d = ctx.wrapper) === null || _d === void 0 ? void 0 : _d.state();
                        expect(state === null || state === void 0 ? void 0 : state.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&theme=light');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should remove editPanel from image url when is first param in querystring', function () { return __awaiter(void 0, void 0, void 0, function () {
            var state;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        mockLocationHref('http://server/#!/test?editPanel=1');
                        ctx.mount({
                            panel: new PanelModel({ id: 1, options: {}, fieldConfig: { defaults: {}, overrides: [] } }),
                        });
                        return [4 /*yield*/, ((_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.instance().buildUrl())];
                    case 1:
                        _c.sent();
                        state = (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.state();
                        expect(state === null || state === void 0 ? void 0 : state.shareUrl).toContain('?editPanel=1&from=1000&to=2000&orgId=1');
                        expect(state === null || state === void 0 ? void 0 : state.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should shorten url', function () {
            var _a;
            mockLocationHref('http://server/#!/test');
            ctx.mount();
            (_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.setState({ useShortUrl: true }, function () { return __awaiter(void 0, void 0, void 0, function () {
                var state;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, ((_a = ctx.wrapper) === null || _a === void 0 ? void 0 : _a.instance().buildUrl())];
                        case 1:
                            _c.sent();
                            state = (_b = ctx.wrapper) === null || _b === void 0 ? void 0 : _b.state();
                            expect(state === null || state === void 0 ? void 0 : state.shareUrl).toContain("/goto/" + mockUid);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=ShareLink.test.js.map