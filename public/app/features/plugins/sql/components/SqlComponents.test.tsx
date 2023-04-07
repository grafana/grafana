import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

import { DatasetSelector } from './DatasetSelector';
import { SqlQueryEditor } from './QueryEditor';
import { buildSqlQueryEditorProps, buildMockDataSelectorProps } from './SqlComponents.testHelpers';

describe('SqlQueryEditor', () => {
  describe('alerts', () => {
    afterEach(cleanup);

    it('should render the `database_update` alert correctly', async () => {
      render(<SqlQueryEditor {...buildSqlQueryEditorProps(true)} />);

      await waitFor(() => {
        expect(screen.getByTestId('database_update')).toBeInTheDocument();
      });
    });

    it('should render the `no_postgres_database` alert correctly', async () => {
      render(
        <SqlQueryEditor
          {...buildSqlQueryEditorProps(undefined, { queryHeaderProps: { disableDatasetSelector: true } })}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('no_postgres_database')).toBeInTheDocument();
      });
    });
  });
});

describe('DatasetSelector', () => {
  describe('should render with the correct default placeholder values', () => {
    afterEach(cleanup);

    it(`should render with 'Select table' since no current dataset is chosen, no dataset has been preconfigured,
        and the selector has not been disabled via 'disableDatasetSelector'`, async () => {
      render(<DatasetSelector {...buildMockDataSelectorProps()} />);

      await waitFor(() => {
        expect(screen.getByText(/Select/i).textContent).toBe('Select table');
      });
    });

    it(`should render with 'Unconfigured database' since a 'disableDatasetSelector' is truthy,
        which means that the datasource is Postgres, and does not have a default configured database`, async () => {
      render(<DatasetSelector {...buildMockDataSelectorProps({ disableDatasetSelector: true })} />);

      await waitFor(() => {
        expect(screen.getByText(/unconfig/i).textContent).toBe('Unconfigured database');
      });
    });

    it('should render with `database 1` since a preconfigured database exists', async () => {
      render(<DatasetSelector {...buildMockDataSelectorProps({ preconfiguredDataset: 'database 1' })} />);

      await waitFor(() => {
        expect(screen.getByText(/database/i).textContent).toBe('database 1');
      });
    });
  });

  describe('should disable the database selector appropriately', () => {
    afterEach(cleanup);

    it('should be disabled if a preconfigured database exists', async () => {
      render(<DatasetSelector {...buildMockDataSelectorProps({ preconfiguredDataset: 'database 1' })} />);
      await waitFor(() => {
        expect(screen.getByLabelText('Dataset selector')).toHaveAttribute('disabled');
      });
    });
    it('should be disabled if `disableDatasetSelector` is true', async () => {
      render(<DatasetSelector {...buildMockDataSelectorProps({ disableDatasetSelector: true })} />);
      await waitFor(() => {
        expect(screen.getByLabelText('Dataset selector')).toHaveProperty('disabled');
      });
    });
    it('should be enabled if `disableDatasetSelector` is false, and there is no preconfigured dataset', async () => {
      render(<DatasetSelector {...buildMockDataSelectorProps()} />);
      await waitFor(() => {
        expect(screen.getByLabelText('Dataset selector')).not.toHaveProperty('disabled', false);
      });
    });
  });

  describe('database calls', () => {
    afterEach(cleanup);

    it('should only query the database when needed', async () => {
      const mockProps = buildMockDataSelectorProps();
      render(<DatasetSelector {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.db.datasets).toHaveBeenCalled();
      });
    });

    it('should not query the database if disabled', async () => {
      const mockProps = buildMockDataSelectorProps({ disableDatasetSelector: true });
      render(<DatasetSelector {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.db.datasets).not.toHaveBeenCalled();
      });
    });

    it('should not query the database if preconfigured', async () => {
      const mockProps = buildMockDataSelectorProps({ preconfiguredDataset: 'database 1' });
      render(<DatasetSelector {...mockProps} />);

      await waitFor(() => {
        expect(mockProps.db.datasets).not.toHaveBeenCalled();
      });
    });
  });
});
