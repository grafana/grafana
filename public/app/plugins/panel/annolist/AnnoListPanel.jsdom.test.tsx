/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Subscription } from 'rxjs';

import {
  type AnnotationEvent,
  arrayToDataFrame,
  DataFrameView,
  type FieldConfigSource,
  getDefaultTimeRange,
  LoadingState,
} from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { backendSrv } from '../../../core/services/backend_srv';
import { isAnnotationApiAvailable } from '../../../features/annotations/isAnnotationApiAvailable';
import { type DashboardSrv, setDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import { getGrafanaSearcher } from '../../../features/search/service/searcher';
import { type QueryResponse } from '../../../features/search/service/types';

import { AnnoListPanel, type Props } from './AnnoListPanel';
import { type Options } from './panelcfg.gen';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('../../../features/annotations/isAnnotationApiAvailable');
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));

jest.mock('../../../features/search/service/searcher', () => ({
  getGrafanaSearcher: jest.fn(),
}));

const mockIsAnnotationApiAvailable = jest.mocked(isAnnotationApiAvailable);
const mockGetFeatureFlagClient = jest.mocked(getFeatureFlagClient);
const getBooleanValueFn = jest.fn();
const mockGetGrafanaSearcher = jest.mocked(getGrafanaSearcher);
const searchMock = jest.fn();

function buildSearchResponse(items: Array<{ uid: string; url: string }>): QueryResponse {
  return {
    view: new DataFrameView(arrayToDataFrame(items)),
    totalRows: items.length,
    loadMoreItems: jest.fn(),
    isItemLoaded: jest.fn(),
  };
}

function stubFFEnabled(enabled: boolean) {
  getBooleanValueFn.mockImplementation((key: string, defaultValue: boolean) =>
    key === FlagKeys.GrafanaKubernetesAnnotationsClient ? enabled : defaultValue
  );
}

mockGetFeatureFlagClient.mockReturnValue({ getBooleanValue: getBooleanValueFn } as unknown as ReturnType<
  typeof getFeatureFlagClient
>);

beforeEach(() => {
  mockIsAnnotationApiAvailable.mockReset();
  getBooleanValueFn.mockReset();
  stubFFEnabled(false);
});

const defaultOptions: Options = {
  limit: 10,
  navigateAfter: '10m',
  navigateBefore: '10m',
  navigateToPanel: true,
  onlyFromThisDashboard: true,
  onlyInTimeRange: false,
  showTags: true,
  showTime: true,
  showUser: true,
  tags: ['tag A', 'tag B'],
};

const defaultResult = {
  text: 'Result text',
  userId: 1,
  userUID: 'u-1',
  login: 'Result login',
  email: 'Result email',
  avatarUrl: 'Result avatarUrl',
  tags: ['Result tag A', 'Result tag B'],
  time: Date.UTC(2021, 0, 1, 0, 0, 0, 0),
  panelId: 13,
  dashboardId: 14, // deliberately different from panelId
  id: '14',
  uid: '7MeksYbmk',
  dashboardUID: '7MeksYbmk',
  url: '/d/asdkjhajksd/some-dash',
};

async function setupTestContext({
  options = defaultOptions,
  results = [defaultResult],
}: { options?: Options; results?: AnnotationEvent[] } = {}) {
  jest.clearAllMocks();

  const getMock = jest.spyOn(backendSrv, 'get');
  getMock.mockResolvedValue(results);

  searchMock.mockReset();
  searchMock.mockResolvedValue(buildSearchResponse([{ uid: defaultResult.uid, url: defaultResult.url }]));
  mockGetGrafanaSearcher.mockReturnValue({ search: searchMock } as unknown as ReturnType<typeof getGrafanaSearcher>);

  const dash = { uid: 'srx16xR4z', formatDate: (time: number) => new Date(time).toISOString() };
  const dashSrv = { getCurrent: () => dash } as DashboardSrv;
  setDashboardSrv(dashSrv);
  const pushSpy = jest.spyOn(locationService, 'push');
  const partialSpy = jest.spyOn(locationService, 'partial');

  const props: Props = {
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
    eventBus: {
      subscribe: jest.fn(),
      getStream: jest.fn().mockImplementation(() => ({ subscribe: jest.fn(() => new Subscription()) })),
      publish: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    },
    fieldConfig: {} as unknown as FieldConfigSource,
    height: 400,
    id: 1,
    onChangeTimeRange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    options,
    renderCounter: 1,
    replaceVariables: (str: string) => str,
    timeRange: getDefaultTimeRange(),
    timeZone: 'utc',
    title: 'Test Title',
    transparent: false,
    width: 320,
  };
  const { rerender } = render(<AnnoListPanel {...props} />);
  await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

  return { props, rerender, getMock, pushSpy, partialSpy };
}

// DOMPurify strips anchors in happy-dom, so these cases need jsdom to exercise link behavior.
describe('AnnoListPanel', () => {
  describe('when there are annotations', () => {
    it("renders annotation item's html content", async () => {
      const { getMock } = await setupTestContext({
        results: [{ ...defaultResult, text: '<a href="/path">test link </a> ' }],
      });

      getMock.mockClear();
      expect(await screen.findByRole('link')).toBeInTheDocument();
      expect(getMock).not.toHaveBeenCalled();
    });

    describe('and the user clicks a link rendered inside the annotation title', () => {
      silenceConsoleOutput();

      it('then the link handles its own navigation and the row does not open the annotation', async () => {
        const { pushSpy, partialSpy } = await setupTestContext({
          results: [{ ...defaultResult, text: '<a href="/path">embedded link</a>' }],
        });

        await userEvent.click(await screen.findByRole('link', { name: /embedded link/i }));

        expect(searchMock).not.toHaveBeenCalled();
        expect(pushSpy).not.toHaveBeenCalled();
        expect(partialSpy).not.toHaveBeenCalled();
      });
    });
  });
});
