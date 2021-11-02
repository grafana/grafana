import { __assign } from "tslib";
import { getFieldLinksForExplore } from './links';
import { ArrayVector, dateTime, FieldType, } from '@grafana/data';
import { setLinkSrv } from '../../../angular/panel/panellinks/link_srv';
import { setContextSrv } from '../../../core/services/context_srv';
describe('getFieldLinksForExplore', function () {
    it('returns correct link model for external link', function () {
        var _a = setup({
            title: 'external',
            url: 'http://regionalhost',
        }), field = _a.field, range = _a.range;
        var links = getFieldLinksForExplore({ field: field, rowIndex: 0, splitOpenFn: jest.fn(), range: range });
        expect(links[0].href).toBe('http://regionalhost');
        expect(links[0].title).toBe('external');
    });
    it('returns generates title for external link', function () {
        var _a = setup({
            title: '',
            url: 'http://regionalhost',
        }), field = _a.field, range = _a.range;
        var links = getFieldLinksForExplore({ field: field, rowIndex: 0, splitOpenFn: jest.fn(), range: range });
        expect(links[0].href).toBe('http://regionalhost');
        expect(links[0].title).toBe('regionalhost');
    });
    it('returns correct link model for internal link', function () {
        var _a = setup({
            title: '',
            url: '',
            internal: {
                query: { query: 'query_1' },
                datasourceUid: 'uid_1',
                datasourceName: 'test_ds',
            },
        }), field = _a.field, range = _a.range;
        var splitfn = jest.fn();
        var links = getFieldLinksForExplore({ field: field, rowIndex: 0, splitOpenFn: splitfn, range: range });
        expect(links[0].href).toBe("/explore?left=" + encodeURIComponent('{"range":{"from":"now-1h","to":"now"},"datasource":"test_ds","queries":[{"query":"query_1"}]}'));
        expect(links[0].title).toBe('test_ds');
        if (links[0].onClick) {
            links[0].onClick({});
        }
        expect(splitfn).toBeCalledWith({
            datasourceUid: 'uid_1',
            query: { query: 'query_1' },
            range: range,
        });
    });
    it('returns correct link model for external link when user does not have access to explore', function () {
        var _a = setup({
            title: 'external',
            url: 'http://regionalhost',
        }, false), field = _a.field, range = _a.range;
        var links = getFieldLinksForExplore({ field: field, rowIndex: 0, range: range });
        expect(links[0].href).toBe('http://regionalhost');
        expect(links[0].title).toBe('external');
    });
    it('returns no internal links if when user does not have access to explore', function () {
        var _a = setup({
            title: '',
            url: '',
            internal: {
                query: { query: 'query_1' },
                datasourceUid: 'uid_1',
                datasourceName: 'test_ds',
            },
        }, false), field = _a.field, range = _a.range;
        var links = getFieldLinksForExplore({ field: field, rowIndex: 0, range: range });
        expect(links).toHaveLength(0);
    });
});
function setup(link, hasAccess) {
    if (hasAccess === void 0) { hasAccess = true; }
    setLinkSrv({
        getDataLinkUIModel: function (link, replaceVariables, origin) {
            return {
                href: link.url,
                title: link.title,
                target: '_blank',
                origin: origin,
            };
        },
        getAnchorInfo: function (link) {
            return __assign({}, link);
        },
        getLinkUrl: function (link) {
            return link.url;
        },
    });
    setContextSrv({
        hasAccessToExplore: function () { return hasAccess; },
    });
    var field = {
        name: 'flux-dimensions',
        type: FieldType.string,
        values: new ArrayVector([]),
        config: {
            links: [link],
        },
    };
    var range = {
        from: dateTime('2020-10-14T00:00:00'),
        to: dateTime('2020-10-14T01:00:00'),
        raw: {
            from: 'now-1h',
            to: 'now',
        },
    };
    return { range: range, field: field };
}
//# sourceMappingURL=links.test.js.map