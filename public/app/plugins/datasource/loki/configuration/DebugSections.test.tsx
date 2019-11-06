import React from 'react';
import { DebugSection } from './DebugSection';
import { mount } from 'enzyme';
import { getLinkSrv, LinkService, LinkSrv, setLinkSrv } from '../../../../features/panel/panellinks/link_srv';
import { TimeSrv } from '../../../../features/dashboard/services/TimeSrv';
import { dateTime } from '@grafana/data';
import { TemplateSrv } from '../../../../features/templating/template_srv';

describe('DebugSection', () => {
  let originalLinkSrv: LinkService;

  // This needs to be setup so we can test interpolation in the debugger
  beforeAll(() => {
    // We do not need more here and TimeSrv is hard to setup fully.
    const timeSrvMock: TimeSrv = {
      timeRangeForUrl() {
        const from = dateTime().subtract(1, 'h');
        const to = dateTime();
        return { from, to, raw: { from, to } };
      },
    } as any;
    const linkService = new LinkSrv(new TemplateSrv(), timeSrvMock);
    originalLinkSrv = getLinkSrv();
    setLinkSrv(linkService);
  });

  afterAll(() => {
    setLinkSrv(originalLinkSrv);
  });

  it('does not render any field if no debug text', () => {
    const wrapper = mount(<DebugSection derivedFields={[]} />);
    expect(wrapper.find('DebugFieldItem').length).toBe(0);
  });

  it('does not render any field if no derived fields', () => {
    const wrapper = mount(<DebugSection derivedFields={[]} />);
    const textarea = wrapper.find('textarea');
    (textarea.getDOMNode() as HTMLTextAreaElement).value = 'traceId=1234';
    textarea.simulate('change');
    expect(wrapper.find('DebugFieldItem').length).toBe(0);
  });

  it('renders derived fields', () => {
    const derivedFields = [
      {
        matcherRegex: 'traceId=(\\w+)',
        name: 'traceIdLink',
        url: 'localhost/trace/${__value.raw}',
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

    const wrapper = mount(<DebugSection derivedFields={derivedFields} />);
    const textarea = wrapper.find('textarea');
    (textarea.getDOMNode() as HTMLTextAreaElement).value = 'traceId=1234';
    textarea.simulate('change');

    expect(wrapper.find('table').length).toBe(1);
    // 3 rows + one header
    expect(wrapper.find('tr').length).toBe(4);
    expect(
      wrapper
        .find('tr')
        .at(1)
        .contains('localhost/trace/1234')
    ).toBeTruthy();
  });
});
