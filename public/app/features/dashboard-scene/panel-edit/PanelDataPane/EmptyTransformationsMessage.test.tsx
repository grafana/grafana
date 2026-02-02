import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import config from 'app/core/config';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { EmptyTransformationsMessage, LegacyEmptyTransformationsMessage } from './EmptyTransformationsMessage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  reportInteraction: jest.fn(),
}));

describe('EmptyTransformationsMessage', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  const onShowPicker = jest.fn();
  const onGoToQueries = jest.fn();
  const onAddTransformation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up feature toggles
    config.featureToggles = config.featureToggles || {};
    config.featureToggles.transformationsEmptyPlaceholder = false;
    config.featureToggles.sqlExpressions = true;
  });

  describe('LegacyEmptyTransformationsMessage', () => {
    it('should render the legacy empty state message', () => {
      render(<LegacyEmptyTransformationsMessage onShowPicker={onShowPicker} />);

      expect(screen.getByText('Start transforming data')).toBeInTheDocument();
      expect(screen.getByText(/Transformations allow data to be changed in various ways/)).toBeInTheDocument();
    });

    it('should call onShowPicker when "Add transformation" button is clicked', async () => {
      const user = userEvent.setup();
      render(<LegacyEmptyTransformationsMessage onShowPicker={onShowPicker} />);

      const button = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await user.click(button);

      expect(onShowPicker).toHaveBeenCalledTimes(1);
    });
  });

  describe('EmptyTransformationsMessage (new UI)', () => {
    beforeEach(() => {
      config.featureToggles.transformationsEmptyPlaceholder = true;
    });

    it('should render SQL expression card and transformation cards when sqlExpressions toggle is enabled', () => {
      config.featureToggles.sqlExpressions = true;

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
        />
      );

      // Should show SQL transformation card
      expect(screen.getByText('Transform with SQL')).toBeInTheDocument();
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
      expect(screen.getByText('Group by')).toBeInTheDocument();
      expect(screen.getByText('Extract fields')).toBeInTheDocument();
      expect(screen.getByText('Filter data by values')).toBeInTheDocument();
    });

    it('should not show SQL expression card when sqlExpressions toggle is disabled', () => {
      config.featureToggles.sqlExpressions = false;

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
        />
      );

      expect(screen.queryByText('Transform with SQL')).not.toBeInTheDocument();
      // But should still show transformation cards
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
    });

    it('should call onGoToQueries when SQL expression card is clicked', async () => {
      config.featureToggles.sqlExpressions = true;
      const user = userEvent.setup();

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
        />
      );

      const sqlCard = screen.getByTestId('transform-with-sql-card');
      const button = sqlCard.querySelector('button');
      await user.click(button!);

      expect(onGoToQueries).toHaveBeenCalledTimes(1);
    });

    it('should not show SQL transformation card when onGoToQueries is not provided', () => {
      render(
        <EmptyTransformationsMessage onShowPicker={onShowPicker} onAddTransformation={onAddTransformation} data={[]} />
      );

      expect(screen.queryByText('Transform with SQL')).not.toBeInTheDocument();
    });

    it('should not show transformation cards grid when neither onGoToQueries nor onAddTransformation are provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} data={[]} />);

      expect(screen.queryByText('Transform with SQL')).not.toBeInTheDocument();

      // But should still show the "Show more" button
      expect(screen.getByTestId(selectors.components.Transforms.addTransformationButton)).toBeInTheDocument();
    });

    it('should hide SQL expression card when datasourceUid is SHARED_DASHBOARD_QUERY', () => {
      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
          datasourceUid={SHARED_DASHBOARD_QUERY}
          queries={[]}
        />
      );

      // SQL card should not be shown for Dashboard datasource (frontend datasource)
      expect(screen.queryByTestId('transform-with-sql-card')).not.toBeInTheDocument();
      // But other transformation cards should still be shown
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
    });

    it('should hide SQL expression card when datasource is frontend-only (meta.backend is false)', () => {
      const mockGetInstanceSettings = jest.fn().mockReturnValue({
        uid: 'test-ds',
        type: 'test',
        name: 'Test DS',
        meta: {
          backend: false, // Frontend datasource
        },
      } as DataSourceInstanceSettings);

      (getDataSourceSrv as jest.Mock).mockReturnValue({
        getInstanceSettings: mockGetInstanceSettings,
      });

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
          datasourceUid="test-ds"
          queries={[]}
        />
      );

      // SQL card should not be shown for frontend datasource
      expect(screen.queryByTestId('transform-with-sql-card')).not.toBeInTheDocument();
    });

    it('should show SQL expression card when datasource is backend (meta.backend is true)', () => {
      const mockGetInstanceSettings = jest.fn().mockReturnValue({
        uid: 'prometheus-uid',
        type: 'prometheus',
        name: 'Prometheus',
        meta: {
          backend: true, // Backend datasource
        },
      } as DataSourceInstanceSettings);

      (getDataSourceSrv as jest.Mock).mockReturnValue({
        getInstanceSettings: mockGetInstanceSettings,
      });

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
          datasourceUid="prometheus-uid"
          queries={[]}
        />
      );

      // SQL card should be shown for backend datasource
      expect(screen.getByTestId('transform-with-sql-card')).toBeInTheDocument();
    });

    it('should hide SQL expression card when Mixed datasource has all frontend datasources', () => {
      const mockGetInstanceSettings = jest.fn((uid: string) => {
        if (uid === 'mixed-uid') {
          return {
            uid: 'mixed-uid',
            type: 'mixed',
            name: 'Mixed',
            meta: {
              mixed: true, // Mixed datasource
            },
          } as DataSourceInstanceSettings;
        }
        if (uid === SHARED_DASHBOARD_QUERY) {
          return {
            uid: SHARED_DASHBOARD_QUERY,
            type: 'dashboard',
            name: 'Dashboard',
            meta: {
              backend: false, // Frontend datasource
            },
          } as DataSourceInstanceSettings;
        }
        return null;
      });

      (getDataSourceSrv as jest.Mock).mockReturnValue({
        getInstanceSettings: mockGetInstanceSettings,
      });

      const queries: DataQuery[] = [
        { refId: 'A', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'dashboard' } },
        { refId: 'B', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'dashboard' } },
      ];

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
          datasourceUid="mixed-uid"
          queries={queries}
        />
      );

      // SQL card should not be shown when all queries use frontend datasources
      expect(screen.queryByTestId('transform-with-sql-card')).not.toBeInTheDocument();
    });

    it('should show SQL expression card when Mixed datasource has at least one backend datasource', () => {
      const mockGetInstanceSettings = jest.fn((uid: string) => {
        if (uid === 'mixed-uid') {
          return {
            uid: 'mixed-uid',
            type: 'mixed',
            name: 'Mixed',
            meta: {
              mixed: true, // Mixed datasource
            },
          } as DataSourceInstanceSettings;
        }
        if (uid === SHARED_DASHBOARD_QUERY) {
          return {
            uid: SHARED_DASHBOARD_QUERY,
            type: 'dashboard',
            name: 'Dashboard',
            meta: {
              backend: false, // Frontend datasource
            },
          } as DataSourceInstanceSettings;
        }
        if (uid === 'prometheus-uid') {
          return {
            uid: 'prometheus-uid',
            type: 'prometheus',
            name: 'Prometheus',
            meta: {
              backend: true, // Backend datasource
            },
          } as DataSourceInstanceSettings;
        }
        return null;
      });

      (getDataSourceSrv as jest.Mock).mockReturnValue({
        getInstanceSettings: mockGetInstanceSettings,
      });

      const queries: DataQuery[] = [
        { refId: 'A', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'dashboard' } },
        { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
      ];

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
          data={[]}
          datasourceUid="mixed-uid"
          queries={queries}
        />
      );

      // SQL card should be shown because at least one query uses a backend datasource
      expect(screen.getByTestId('transform-with-sql-card')).toBeInTheDocument();
    });
  });
});
