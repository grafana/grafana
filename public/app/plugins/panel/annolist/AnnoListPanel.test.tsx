import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AnnotationEvent, type FieldConfigSource, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { backendSrv } from '../../../core/services/backend_srv';
import { type DashboardSrv, setDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';

import { AnnoListPanel, type Props } from './AnnoListPanel';
import { type Options } from './panelcfg.gen';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

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

  const dash = { uid: 'srx16xR4z', formatDate: (time: number) => new Date(time).toISOString() };
  const dashSrv = { getCurrent: () => dash } as DashboardSrv;
  setDashboardSrv(dashSrv);
  const pushSpy = jest.spyOn(locationService, 'push');
  const partialSpy = jest.spyOn(locationService, 'partial');

  const props: Props = {
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
    eventBus: {
      subscribe: jest.fn(),
      getStream: jest.fn().mockImplementation(() => ({
        subscribe: jest.fn(),
      })),
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

describe('AnnoListPanel', () => {
  describe('when mounted', () => {
    it('then it should fetch annotations', async () => {
      const { getMock } = await setupTestContext();

      expect(getMock).toHaveBeenCalledWith(
        '/api/annotations',
        {
          dashboardUID: 'srx16xR4z',
          limit: 10,
          tags: ['tag A', 'tag B'],
          type: 'annotation',
        },
        expect.stringMatching(/^anno-list-panel-\d\.\d+/) // string is appended with Math.random()
      );
    });
  });

  describe('when there are no annotations', () => {
    it('then it should show a no annotations message', async () => {
      await setupTestContext({ results: [] });

      expect(await screen.findByText(/no annotations found/i)).toBeInTheDocument();
    });
  });

  describe('when there are annotations', () => {
    it('then it renders the annotations correctly', async () => {
      await setupTestContext();

      expect(screen.queryByText(/no annotations found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/result email/i)).not.toBeInTheDocument();
      expect(await screen.findByText(/result text/i)).toBeInTheDocument();
      expect(await screen.findByRole('img')).toBeInTheDocument();
      expect(await screen.findByText('Result tag A')).toBeInTheDocument();
      expect(await screen.findByText('Result tag B')).toBeInTheDocument();
      expect(await screen.findByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
    });

    it("renders annotation item's html content", async () => {
      const { getMock } = await setupTestContext({
        results: [{ ...defaultResult, text: '<a href="/path">test link </a> ' }],
      });

      getMock.mockClear();
      expect(await screen.findByRole('link')).toBeInTheDocument();
      expect(getMock).not.toHaveBeenCalled();
    });

    describe('and login property is missing in annotation', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({ results: [{ ...defaultResult, login: undefined }] });

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(await screen.findByText(/result text/i)).toBeInTheDocument();
        expect(await screen.findByText('Result tag A')).toBeInTheDocument();
        expect(await screen.findByText('Result tag B')).toBeInTheDocument();
        expect(await screen.findByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
      });
    });

    describe('and property is missing in annotation', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({ results: [{ ...defaultResult, time: undefined }] });

        expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
        expect(await screen.findByText(/result text/i)).toBeInTheDocument();
        expect(await screen.findByRole('img')).toBeInTheDocument();
        expect(await screen.findByText('Result tag A')).toBeInTheDocument();
        expect(await screen.findByText('Result tag B')).toBeInTheDocument();
      });
    });

    describe('and show user option is off', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({
          options: { ...defaultOptions, showUser: false },
        });

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(await screen.findByText(/result text/i)).toBeInTheDocument();
        expect(await screen.findByText('Result tag A')).toBeInTheDocument();
        expect(await screen.findByText('Result tag B')).toBeInTheDocument();
        expect(await screen.findByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
      });
    });

    describe('and show time option is off', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({
          options: { ...defaultOptions, showTime: false },
        });

        expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
        expect(await screen.findByText(/result text/i)).toBeInTheDocument();
        expect(await screen.findByRole('img')).toBeInTheDocument();
        expect(await screen.findByText('Result tag A')).toBeInTheDocument();
        expect(await screen.findByText('Result tag B')).toBeInTheDocument();
      });
    });

    describe('and show tags option is off', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({
          options: { ...defaultOptions, showTags: false },
        });

        expect(screen.queryByText('Result tag A')).not.toBeInTheDocument();
        expect(screen.queryByText('Result tag B')).not.toBeInTheDocument();
        expect(await screen.findByText(/result text/i)).toBeInTheDocument();
        expect(await screen.findByRole('img')).toBeInTheDocument();
        expect(await screen.findByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
      });
    });

    describe('and the user clicks on the annotation', () => {
      it('then it should navigate to the dashboard connected to the annotation', async () => {
        const { getMock, pushSpy } = await setupTestContext();

        getMock.mockClear();
        expect(await screen.findByRole('button', { name: /result text/i })).toBeInTheDocument();
        await userEvent.click(await screen.findByRole('button', { name: /result text/i }));
        await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

        expect(getMock).toHaveBeenCalledWith('/api/search', { dashboardUIDs: '7MeksYbmk' });
        expect(pushSpy).toHaveBeenCalledTimes(1);
        expect(pushSpy).toHaveBeenCalledWith('/d/asdkjhajksd/some-dash?from=1609458600000&to=1609459800000');
      });

      it('should default to the current dashboard, if no dashboard is associated with the annotation', async () => {
        const { getMock, partialSpy } = await setupTestContext({
          results: [{ ...defaultResult, dashboardUID: null, panelId: 0 }],
        });
        getMock.mockClear();
        expect(await screen.findByRole('button', { name: /result text/i })).toBeInTheDocument();

        await userEvent.click(await screen.findByRole('button', { name: /result text/i }));

        expect(getMock).not.toHaveBeenCalled();
        expect(partialSpy).toHaveBeenCalledTimes(1);
        expect(partialSpy).toHaveBeenCalledWith({ from: 1609458600000, to: 1609459800000, viewPanel: undefined });
      });

      it('should default to the current dashboard, if no dashboard is associated with the annotation and navigate to viewPanel', async () => {
        const { getMock, partialSpy } = await setupTestContext({
          results: [{ ...defaultResult, dashboardUID: null }],
        });
        getMock.mockClear();
        expect(await screen.findByRole('button', { name: /result text/i })).toBeInTheDocument();

        await userEvent.click(await screen.findByRole('button', { name: /result text/i }));

        expect(getMock).not.toHaveBeenCalled();
        expect(partialSpy).toHaveBeenCalledTimes(1);
        expect(partialSpy).toHaveBeenCalledWith({ from: 1609458600000, to: 1609459800000, viewPanel: 13 });
      });
    });

    describe('and the user clicks on a tag', () => {
      it('then it should navigate to the dashboard connected to the annotation', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();

        expect(await screen.findByRole('button', { name: /result tag b/i })).toBeInTheDocument();
        await userEvent.click(await screen.findByRole('button', { name: /result tag b/i }));

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith(
          '/api/annotations',
          {
            dashboardUID: 'srx16xR4z',
            limit: 10,
            tags: ['tag A', 'tag B', 'Result tag B'],
            type: 'annotation',
          },
          expect.stringMatching(/^anno-list-panel-\d\.\d+/) // string is appended with Math.random()
        );
        expect(await screen.findByText(/filter:/i)).toBeInTheDocument();
        expect(await screen.findAllByText(/result tag b/i)).toHaveLength(2);
      });
    });

    describe('and the user clicks on the user avatar', () => {
      it('then it should filter annotations by login and the filter should show', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();
        expect(await screen.findByRole('img')).toBeInTheDocument();
        await userEvent.click(await screen.findByRole('img'));

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith(
          '/api/annotations',
          {
            dashboardUID: 'srx16xR4z',
            limit: 10,
            tags: ['tag A', 'tag B'],
            type: 'annotation',
            userId: 1,
          },
          expect.stringMatching(/^anno-list-panel-\d\.\d+/) // string is appended with Math.random()
        );
        expect(await screen.findByText(/filter:/i)).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /result email/i })).toBeInTheDocument();
      });
    });

    describe('and the user hovers over the user avatar', () => {
      silenceConsoleOutput(); // Popper throws an act error, but if we add act around the hover here it doesn't matter
      it('then it should filter annotations by login', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();
        expect(await screen.findByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('with kubernetesAnnotationsClient toggle ON', () => {
    const SEARCH_URL = '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1/search';
    const DISPLAY_URL = '/apis/iam.grafana.app/v0alpha1/namespaces/stack-1/display';
    const USER_URL = '/apis/iam.grafana.app/v0alpha1/namespaces/stack-1/users/u-001';

    const k8sAnnotation = {
      apiVersion: 'annotation.grafana.app/v0alpha1',
      kind: 'Annotation',
      metadata: {
        name: 'a-14',
        annotations: { 'grafana.app/createdBy': 'user:u-001' },
        resourceVersion: '1',
        creationTimestamp: '',
      },
      spec: {
        text: 'Result text',
        time: Date.UTC(2021, 0, 1, 0, 0, 0, 0),
        timeEnd: Date.UTC(2021, 0, 1, 0, 0, 0, 0),
        dashboardUID: '7MeksYbmk',
        panelID: 13,
        tags: ['Result tag A', 'Result tag B'],
      },
    };

    const display = {
      identity: { type: 'user', name: 'u-001' },
      displayName: 'jane.doe',
      avatarURL: '/avatar/u-001.png',
      internalId: 1,
    };

    const setupK8sContext = async (options: Options = defaultOptions) => {
      jest.clearAllMocks();
      config.featureToggles.kubernetesAnnotationsClient = true;
      config.namespace = 'stack-1';

      const getMock = jest.spyOn(backendSrv, 'get');
      getMock.mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('/search')) {
          return { items: [k8sAnnotation] };
        }
        if (typeof url === 'string' && url.includes('/display')) {
          return { display: [display] };
        }
        if (typeof url === 'string' && url.includes('/users/u-001')) {
          return { spec: { email: 'jane@example.com' } };
        }
        return [];
      });

      const dash = { uid: 'srx16xR4z', formatDate: (time: number) => new Date(time).toISOString() };
      setDashboardSrv({ getCurrent: () => dash } as DashboardSrv);

      const props: Props = {
        data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
        eventBus: {
          subscribe: jest.fn(),
          getStream: jest.fn().mockImplementation(() => ({ subscribe: jest.fn() })),
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
      render(<AnnoListPanel {...props} />);
      await waitFor(() => expect(getMock).toHaveBeenCalled());
      return { getMock };
    };

    afterEach(() => {
      config.featureToggles.kubernetesAnnotationsClient = false;
    });

    it('hits the k8s /search endpoint with translated params', async () => {
      const { getMock } = await setupK8sContext();

      // /search call: legacy `tags` becomes repeated `tag`, no `type: 'annotation'` (backend hardcodes it)
      expect(getMock).toHaveBeenCalledWith(
        SEARCH_URL,
        expect.objectContaining({
          dashboardUID: 'srx16xR4z',
          limit: 10,
          tag: ['tag A', 'tag B'],
        }),
        expect.stringMatching(/^anno-list-panel-\d\.\d+/)
      );
    });

    it('hydrates identity fields via the IAM /display endpoint and renders the avatar', async () => {
      const { getMock } = await setupK8sContext();

      expect(getMock).toHaveBeenCalledWith(DISPLAY_URL, { key: ['user:u-001'] });
      expect(getMock).toHaveBeenCalledWith(USER_URL);

      // displayName gates the avatar, email comes from the User resource
      const avatar = await screen.findByRole('img');
      expect(avatar).toBeInTheDocument();
      expect(await screen.findByText(/result text/i)).toBeInTheDocument();
    });

    it('falls back to displayName when the User resource fetch fails (e.g. RBAC)', async () => {
      jest.clearAllMocks();
      config.featureToggles.kubernetesAnnotationsClient = true;
      config.namespace = 'stack-1';

      const getMock = jest.spyOn(backendSrv, 'get');
      getMock.mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('/search')) {
          return { items: [k8sAnnotation] };
        }
        if (typeof url === 'string' && url.includes('/display')) {
          return { display: [display] };
        }
        if (typeof url === 'string' && url.includes('/users/u-001')) {
          throw new Error('forbidden');
        }
        return [];
      });

      const dash = { uid: 'srx16xR4z', formatDate: (time: number) => new Date(time).toISOString() };
      setDashboardSrv({ getCurrent: () => dash } as DashboardSrv);

      const props: Props = {
        data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
        eventBus: {
          subscribe: jest.fn(),
          getStream: jest.fn().mockImplementation(() => ({ subscribe: jest.fn() })),
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
        options: defaultOptions,
        renderCounter: 1,
        replaceVariables: (str: string) => str,
        timeRange: getDefaultTimeRange(),
        timeZone: 'utc',
        title: 'Test Title',
        transparent: false,
        width: 320,
      };
      render(<AnnoListPanel {...props} />);

      const avatar = await screen.findByRole('img');
      expect(avatar).toBeInTheDocument();
      expect(await screen.findByText(/result text/i)).toBeInTheDocument();
    });

    it('clicking the avatar filters subsequent searches by createdBy uid', async () => {
      const { getMock } = await setupK8sContext();
      getMock.mockClear();
      // Re-mock for the post-click search
      getMock.mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('/search')) {
          return { items: [k8sAnnotation] };
        }
        if (typeof url === 'string' && url.includes('/display')) {
          return { display: [display] };
        }
        if (typeof url === 'string' && url.includes('/users/u-001')) {
          return { spec: { email: 'jane@example.com' } };
        }
        return [];
      });

      await userEvent.click(await screen.findByRole('img'));

      await waitFor(() => {
        expect(getMock).toHaveBeenCalledWith(
          SEARCH_URL,
          expect.objectContaining({ createdBy: 'user:u-001' }),
          expect.any(String)
        );
      });
    });
  });
});
