import { render, waitFor } from '@testing-library/react';
import { act } from 'react';

import { config } from '@grafana/runtime';

import { GrafanaDatasource } from '../datasource';
import { GrafanaQuery, GrafanaQueryType } from '../types';

import { QueryEditor } from './QueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {},
  },
}));

jest.mock('app/features/live/info', () => ({
  getManagedChannelInfo: jest.fn(() => Promise.resolve({ channels: [], channelFields: {} })),
}));

describe('QueryEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnRunQuery = jest.fn();
  const mockDatasource = {} as GrafanaDatasource;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Random Walk configuration', () => {
    it('should render random walk editor when feature toggle is enabled', async () => {
      config.featureToggles.dashboardTemplates = true;

      const query: GrafanaQuery = {
        refId: 'A',
        queryType: GrafanaQueryType.RandomWalk,
      };

      await act(async () => {
        render(
          <QueryEditor datasource={mockDatasource} query={query} onChange={mockOnChange} onRunQuery={mockOnRunQuery} />
        );
      });

      // Wait for async operations to complete
      await waitFor(() => {
        // Verify random walk configuration fields are rendered using IDs
        expect(document.querySelector('#randomWalk-seriesCount-A')).toBeInTheDocument();
        expect(document.querySelector('#randomWalk-startValue-A')).toBeInTheDocument();
        expect(document.querySelector('#randomWalk-spread-A')).toBeInTheDocument();
      });
    });

    it('should not render random walk editor when feature toggle is disabled', async () => {
      config.featureToggles.dashboardTemplates = false;

      const query: GrafanaQuery = {
        refId: 'A',
        queryType: GrafanaQueryType.RandomWalk,
      };

      await act(async () => {
        render(
          <QueryEditor datasource={mockDatasource} query={query} onChange={mockOnChange} onRunQuery={mockOnRunQuery} />
        );
      });

      // Wait for component to settle
      await waitFor(() => {
        // Verify random walk configuration fields are NOT rendered
        expect(document.querySelector('#randomWalk-seriesCount-A')).not.toBeInTheDocument();
        expect(document.querySelector('#randomWalk-startValue-A')).not.toBeInTheDocument();
        expect(document.querySelector('#randomWalk-spread-A')).not.toBeInTheDocument();
      });
    });
  });
});
