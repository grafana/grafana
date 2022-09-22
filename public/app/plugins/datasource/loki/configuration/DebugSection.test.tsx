import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, TimeRange } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';

import { getLinkSrv, LinkService, LinkSrv, setLinkSrv } from '../../../../features/panel/panellinks/link_srv';

import { DebugSection } from './DebugSection';

// We do not need more here and TimeSrv is hard to setup fully.
jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: () => ({
    timeRangeForUrl() {
      const from = dateTime().subtract(1, 'h');
      const to = dateTime();
      return { from, to, raw: { from, to } };
    },
  }),
}));

describe('DebugSection', () => {
  let originalLinkSrv: LinkService;

  // This needs to be setup so we can test interpolation in the debugger
  beforeAll(() => {
    const linkService = new LinkSrv();
    originalLinkSrv = getLinkSrv();
    setLinkSrv(linkService);
  });

  beforeEach(() => {
    setTemplateSrv({
      replace(target, scopedVars, format) {
        return target ?? '';
      },
      getVariables() {
        return [];
      },
      containsTemplate() {
        return false;
      },
      updateTimeRange(timeRange: TimeRange) {},
    });
  });

  afterAll(() => {
    setLinkSrv(originalLinkSrv);
  });

  it('does not render any table rows if no debug text', () => {
    render(<DebugSection derivedFields={[]} />);
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });

  it('renders derived fields as table rows', async () => {
    const derivedFields = [
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

    render(<DebugSection derivedFields={derivedFields} />);
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'traceId=1234');

    expect(screen.getByRole('table')).toBeInTheDocument();
    // 3 rows + one header
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(4);
    expect(rows[1]).toHaveTextContent('http://localhost/trace/${__value.raw}');
  });
});
