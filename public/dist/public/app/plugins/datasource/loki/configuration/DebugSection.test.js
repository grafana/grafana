import React from 'react';
import { DebugSection } from './DebugSection';
import { mount } from 'enzyme';
import { getLinkSrv, LinkSrv, setLinkSrv } from '../../../../angular/panel/panellinks/link_srv';
import { dateTime } from '@grafana/data';
// We do not need more here and TimeSrv is hard to setup fully.
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: function () { return ({
        timeRangeForUrl: function () {
            var from = dateTime().subtract(1, 'h');
            var to = dateTime();
            return { from: from, to: to, raw: { from: from, to: to } };
        },
    }); },
}); });
describe('DebugSection', function () {
    var originalLinkSrv;
    // This needs to be setup so we can test interpolation in the debugger
    beforeAll(function () {
        var linkService = new LinkSrv();
        originalLinkSrv = getLinkSrv();
        setLinkSrv(linkService);
    });
    afterAll(function () {
        setLinkSrv(originalLinkSrv);
    });
    it('does not render any field if no debug text', function () {
        var wrapper = mount(React.createElement(DebugSection, { derivedFields: [] }));
        expect(wrapper.find('DebugFieldItem').length).toBe(0);
    });
    it('does not render any field if no derived fields', function () {
        var wrapper = mount(React.createElement(DebugSection, { derivedFields: [] }));
        var textarea = wrapper.find('textarea');
        textarea.getDOMNode().value = 'traceId=1234';
        textarea.simulate('change');
        expect(wrapper.find('DebugFieldItem').length).toBe(0);
    });
    it('renders derived fields', function () {
        var derivedFields = [
            {
                matcherRegex: 'traceId=(\\w+)',
                name: 'traceIdLink',
                url: 'http://localhost/trace/${__value.raw}',
            },
            {
                matcherRegex: 'traceId=(\\w+)',
                name: 'traceId',
            },
            {
                matcherRegex: 'traceId=(',
                name: 'error',
            },
        ];
        var wrapper = mount(React.createElement(DebugSection, { derivedFields: derivedFields }));
        var textarea = wrapper.find('textarea');
        textarea.getDOMNode().value = 'traceId=1234';
        textarea.simulate('change');
        expect(wrapper.find('table').length).toBe(1);
        // 3 rows + one header
        expect(wrapper.find('tr').length).toBe(4);
        expect(wrapper.find('tr').at(1).contains('http://localhost/trace/1234')).toBeTruthy();
    });
});
//# sourceMappingURL=DebugSection.test.js.map