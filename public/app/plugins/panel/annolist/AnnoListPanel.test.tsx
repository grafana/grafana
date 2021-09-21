import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { AnnoListPanel, Props } from './AnnoListPanel';
import { AnnotationEvent, FieldConfigSource, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { AnnoOptions } from './types';
import { backendSrv } from '../../../core/services/backend_srv';
import userEvent from '@testing-library/user-event';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { setDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const defaultOptions: AnnoOptions = {
  limit: 10,
  navigateAfter: '10m',
  navigateBefore: '20m',
  navigateToPanel: true,
  onlyFromThisDashboard: true,
  onlyInTimeRange: false,
  showTags: true,
  showTime: true,
  showUser: true,
  tags: ['tag A', 'tag B'],
};

const defaultResult: AnnotationEvent = {
  text: 'Result text',
  userId: 1,
  login: 'Result login',
  email: 'Result email',
  avatarUrl: 'Result avatarUrl',
  tags: ['Result tag A', 'Result tag B'],
  time: Date.UTC(2021, 0, 1, 0, 0, 0, 0),
  panelId: 13,
  dashboardId: 14, // deliberately different from panelId
};

async function setupTestContext({
  options = defaultOptions,
  results = [defaultResult],
}: { options?: AnnoOptions; results?: AnnotationEvent[] } = {}) {
  jest.clearAllMocks();

  const getMock = jest.spyOn(backendSrv, 'get');
  getMock.mockResolvedValue(results);

  const dash: any = { id: 1, formatDate: (time: number) => new Date(time).toISOString() };
  const dashSrv: any = { getCurrent: () => dash };
  setDashboardSrv(dashSrv);

  const props: Props = {
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
    eventBus: {
      subscribe: jest.fn(),
      getStream: () =>
        ({
          subscribe: jest.fn(),
        } as any),
      publish: jest.fn(),
      removeAllListeners: jest.fn(),
      newScopedBus: jest.fn(),
    },
    fieldConfig: ({} as unknown) as FieldConfigSource,
    height: 400,
    id: 1,
    onChangeTimeRange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    options,
    renderCounter: 1,
    replaceVariables: jest.fn(),
    timeRange: getDefaultTimeRange(),
    timeZone: 'utc',
    title: 'Test Title',
    transparent: false,
    width: 320,
  };
  const { rerender } = render(<AnnoListPanel {...props} />);
  await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

  return { props, rerender, getMock };
}

describe('AnnoListPanel', () => {
  describe('when mounted', () => {
    it('then it should fetch annotations', async () => {
      const { getMock } = await setupTestContext();

      expect(getMock).toHaveBeenCalledWith(
        '/api/annotations',
        {
          dashboardId: 1,
          limit: 10,
          tags: ['tag A', 'tag B'],
          type: 'annotation',
        },
        'anno-list-panel-1'
      );
    });
  });

  describe('when there are no annotations', () => {
    it('then it should show a no annotations message', async () => {
      await setupTestContext({ results: [] });

      expect(screen.getByText(/no annotations found/i)).toBeInTheDocument();
    });
  });

  describe('when there are annotations', () => {
    it('then it renders the annotations correctly', async () => {
      await setupTestContext();

      expect(screen.queryByText(/no annotations found/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/result email/i)).not.toBeInTheDocument();
      expect(screen.getByText(/result text/i)).toBeInTheDocument();
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByText('Result tag A')).toBeInTheDocument();
      expect(screen.getByText('Result tag B')).toBeInTheDocument();
      expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
    });

    describe('and login property is missing in annotation', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({ results: [{ ...defaultResult, login: undefined }] });

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByText(/result text/i)).toBeInTheDocument();
        expect(screen.getByText('Result tag A')).toBeInTheDocument();
        expect(screen.getByText('Result tag B')).toBeInTheDocument();
        expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
      });
    });

    describe('and property is missing in annotation', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({ results: [{ ...defaultResult, time: undefined }] });

        expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
        expect(screen.getByText(/result text/i)).toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByText('Result tag A')).toBeInTheDocument();
        expect(screen.getByText('Result tag B')).toBeInTheDocument();
      });
    });

    describe('and show user option is off', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({
          options: { ...defaultOptions, showUser: false },
        });

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByText(/result text/i)).toBeInTheDocument();
        expect(screen.getByText('Result tag A')).toBeInTheDocument();
        expect(screen.getByText('Result tag B')).toBeInTheDocument();
        expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
      });
    });

    describe('and show time option is off', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({
          options: { ...defaultOptions, showTime: false },
        });

        expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
        expect(screen.getByText(/result text/i)).toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByText('Result tag A')).toBeInTheDocument();
        expect(screen.getByText('Result tag B')).toBeInTheDocument();
      });
    });

    describe('and show tags option is off', () => {
      it('then it renders the annotations correctly', async () => {
        await setupTestContext({
          options: { ...defaultOptions, showTags: false },
        });

        expect(screen.queryByText('Result tag A')).not.toBeInTheDocument();
        expect(screen.queryByText('Result tag B')).not.toBeInTheDocument();
        expect(screen.getByText(/result text/i)).toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
      });
    });

    describe('and the user clicks on the annotation', () => {
      it('then it should navigate to the dashboard connected to the annotation', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();
        expect(screen.getByText(/result text/i)).toBeInTheDocument();
        userEvent.click(screen.getByText(/result text/i));

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith('/api/search', { dashboardIds: 14 });
      });
    });

    describe('and the user clicks on a tag', () => {
      it('then it should navigate to the dashboard connected to the annotation', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();
        expect(screen.getByText('Result tag B')).toBeInTheDocument();
        userEvent.click(screen.getByText('Result tag B'));

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith(
          '/api/annotations',
          {
            dashboardId: 1,
            limit: 10,
            tags: ['tag A', 'tag B', 'Result tag B'],
            type: 'annotation',
          },
          'anno-list-panel-1'
        );
        expect(screen.getByText(/filter:/i)).toBeInTheDocument();
        expect(screen.getAllByText(/result tag b/i)).toHaveLength(2);
      });
    });

    describe('and the user clicks on the user avatar', () => {
      it('then it should filter annotations by login and the filter should show', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();
        expect(screen.getByRole('img')).toBeInTheDocument();
        userEvent.click(screen.getByRole('img'));

        expect(getMock).toHaveBeenCalledTimes(1);
        expect(getMock).toHaveBeenCalledWith(
          '/api/annotations',
          {
            dashboardId: 1,
            limit: 10,
            tags: ['tag A', 'tag B'],
            type: 'annotation',
            userId: 1,
          },
          'anno-list-panel-1'
        );
        expect(screen.getByText(/filter:/i)).toBeInTheDocument();
        expect(screen.getByText(/result email/i)).toBeInTheDocument();
      });
    });

    describe('and the user hovers over the user avatar', () => {
      silenceConsoleOutput(); // Popper throws an act error, but if we add act around the hover here it doesn't matter
      it('then it should filter annotations by login', async () => {
        const { getMock } = await setupTestContext();

        getMock.mockClear();
        expect(screen.getByRole('img')).toBeInTheDocument();
        userEvent.hover(screen.getByRole('img'));

        expect(screen.getByText(/result email/i)).toBeInTheDocument();
      });
    });
  });
});
