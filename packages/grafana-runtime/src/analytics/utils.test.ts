import { config } from '../config';
import { locationService } from '../services';
import { getEchoSrv, EchoEventType } from '../services/EchoSrv';

import { MAX_PAGE_URL_LENGTH, TRUNCATION_MARKER, reportPageview } from './utils';

jest.mock('../services/EchoSrv');
jest.mock('../services', () => ({
  locationService: {
    getLocation: jest.fn(),
  },
}));
jest.mock('../config', () => ({
  config: { appSubUrl: '' },
}));

const mockAddEvent = jest.fn();
jest.mocked(getEchoSrv).mockReturnValue({ addEvent: mockAddEvent } as unknown as ReturnType<typeof getEchoSrv>);

describe('reportPageview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEchoSrv).mockReturnValue({ addEvent: mockAddEvent } as unknown as ReturnType<typeof getEchoSrv>);
    config.appSubUrl = '';
  });

  it('reports the full URL when it is within the length limit', () => {
    const shortUrl = '/d/abc?var-cluster=prod';
    jest.mocked(locationService.getLocation).mockReturnValue({
      pathname: '/d/abc',
      search: '?var-cluster=prod',
      hash: '',
    } as ReturnType<typeof locationService.getLocation>);

    reportPageview();

    expect(mockAddEvent).toHaveBeenCalledWith({
      type: EchoEventType.Pageview,
      payload: { page: shortUrl },
    });
  });

  it('truncates and appends the marker when the URL exceeds MAX_PAGE_URL_LENGTH', () => {
    const longSearch = '?var-cluster=' + 'x'.repeat(MAX_PAGE_URL_LENGTH);
    jest.mocked(locationService.getLocation).mockReturnValue({
      pathname: '/d/abc',
      search: longSearch,
      hash: '',
    } as ReturnType<typeof locationService.getLocation>);

    reportPageview();

    const reportedPage: string = mockAddEvent.mock.calls[0][0].payload.page;
    expect(reportedPage.length).toBe(MAX_PAGE_URL_LENGTH);
    expect(reportedPage.endsWith(TRUNCATION_MARKER)).toBe(true);
  });

  it('includes appSubUrl in the URL', () => {
    config.appSubUrl = '/grafana';
    jest.mocked(locationService.getLocation).mockReturnValue({
      pathname: '/d/abc',
      search: '',
      hash: '',
    } as ReturnType<typeof locationService.getLocation>);

    reportPageview();

    expect(mockAddEvent).toHaveBeenCalledWith({
      type: EchoEventType.Pageview,
      payload: { page: '/grafana/d/abc' },
    });
  });
});
