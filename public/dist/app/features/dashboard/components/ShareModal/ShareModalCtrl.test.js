import config from 'app/core/config';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { ShareModalCtrl } from './ShareModalCtrl';
describe('ShareModalCtrl', function () {
    var ctx = {
        timeSrv: {
            timeRange: function () {
                return { from: new Date(1000), to: new Date(2000) };
            },
        },
        $location: {
            absUrl: function () { return 'http://server/#!/test'; },
            search: function () {
                return { from: '', to: '' };
            },
        },
        scope: {
            dashboard: {
                meta: {
                    isSnapshot: true,
                },
            },
        },
        templateSrv: {
            fillVariableValuesForUrl: function () { },
        },
    };
    window.Intl.DateTimeFormat = function () {
        return {
            resolvedOptions: function () {
                return { timeZone: 'UTC' };
            },
        };
    };
    beforeEach(function () {
        config.bootData = {
            user: {
                orgId: 1,
            },
        };
        ctx.ctrl = new ShareModalCtrl(ctx.scope, {}, ctx.$location, {}, ctx.timeSrv, ctx.templateSrv, new LinkSrv({}, ctx.stimeSrv));
    });
    describe('shareUrl with current time range and panel', function () {
        it('should generate share url absolute time', function () {
            ctx.scope.panel = { id: 22 };
            ctx.scope.init();
            expect(ctx.scope.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&panelId=22&fullscreen');
        });
        it('should generate render url', function () {
            ctx.$location.absUrl = function () { return 'http://dashboards.grafana.com/d/abcdefghi/my-dash'; };
            ctx.scope.panel = { id: 22 };
            ctx.scope.init();
            var base = 'http://dashboards.grafana.com/render/d-solo/abcdefghi/my-dash';
            var params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
            expect(ctx.scope.imageUrl).toContain(base + params);
        });
        it('should generate render url for scripted dashboard', function () {
            ctx.$location.absUrl = function () { return 'http://dashboards.grafana.com/dashboard/script/my-dash.js'; };
            ctx.scope.panel = { id: 22 };
            ctx.scope.init();
            var base = 'http://dashboards.grafana.com/render/dashboard-solo/script/my-dash.js';
            var params = '?from=1000&to=2000&orgId=1&panelId=22&width=1000&height=500&tz=UTC';
            expect(ctx.scope.imageUrl).toContain(base + params);
        });
        it('should remove panel id when no panel in scope', function () {
            ctx.$location.absUrl = function () { return 'http://server/#!/test'; };
            ctx.scope.options.forCurrent = true;
            ctx.scope.panel = null;
            ctx.scope.init();
            expect(ctx.scope.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1');
        });
        it('should add theme when specified', function () {
            ctx.scope.options.theme = 'light';
            ctx.scope.panel = null;
            ctx.scope.init();
            expect(ctx.scope.shareUrl).toBe('http://server/#!/test?from=1000&to=2000&orgId=1&theme=light');
        });
        it('should remove fullscreen from image url when is first param in querystring and modeSharePanel is true', function () {
            ctx.$location.search = function () {
                return { fullscreen: true, edit: true };
            };
            ctx.$location.absUrl = function () { return 'http://server/#!/test?fullscreen&edit'; };
            ctx.scope.modeSharePanel = true;
            ctx.scope.panel = { id: 1 };
            ctx.scope.buildUrl();
            expect(ctx.scope.shareUrl).toContain('?fullscreen&edit&from=1000&to=2000&orgId=1&panelId=1');
            expect(ctx.scope.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
        });
        it('should remove edit from image url when is first param in querystring and modeSharePanel is true', function () {
            ctx.$location.search = function () {
                return { edit: true, fullscreen: true };
            };
            ctx.$location.absUrl = function () { return 'http://server/#!/test?edit&fullscreen'; };
            ctx.scope.modeSharePanel = true;
            ctx.scope.panel = { id: 1 };
            ctx.scope.buildUrl();
            expect(ctx.scope.shareUrl).toContain('?edit&fullscreen&from=1000&to=2000&orgId=1&panelId=1');
            expect(ctx.scope.imageUrl).toContain('?from=1000&to=2000&orgId=1&panelId=1&width=1000&height=500&tz=UTC');
        });
        it('should include template variables in url', function () {
            ctx.$location.search = function () {
                return {};
            };
            ctx.$location.absUrl = function () { return 'http://server/#!/test'; };
            ctx.scope.options.includeTemplateVars = true;
            ctx.templateSrv.fillVariableValuesForUrl = function (params) {
                params['var-app'] = 'mupp';
                params['var-server'] = 'srv-01';
            };
            ctx.scope.buildUrl();
            expect(ctx.scope.shareUrl).toContain('http://server/#!/test?from=1000&to=2000&orgId=1&var-app=mupp&var-server=srv-01');
        });
    });
});
//# sourceMappingURL=ShareModalCtrl.test.js.map