import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { DatasetSelector } from './DatasetSelector';
import { SqlQueryEditor } from './QueryEditor';
import { buildSqlQueryEditorProps, buildMockDataSelectorProps, buildMockDatasource } from './SqlComponents.testHelpers';

describe('SqlQueryEditor', () => {
  describe('alerts', () => {
    const database_update_text = 'Your default database configuration has been changed or updated';
    const no_postgres_database_text = 'You do not currenlty have a database configured for this datasource';

    it('should ONLY render the `database update` alert', async () => {
      // @ts-ignore
      // Property 'templateSrv' is a protected type and is not a class derived from 'SqlDatasource'.ts(2322); Oh hush now.
      render(<SqlQueryEditor {...buildSqlQueryEditorProps({ datasource: buildMockDatasource(true) })} />);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain(database_update_text);
        expect(alert.textContent).not.toContain(no_postgres_database_text);
      });
    });

    it('should ONLY render the `no postgres database` alert', async () => {
      render(<SqlQueryEditor {...buildSqlQueryEditorProps({ queryHeaderProps: { disableDatasetSelector: true } })} />);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain(no_postgres_database_text);
        expect(alert.textContent).not.toContain(no_postgres_database_text);
      });
    });
  });
});

describe('DatasetSelector', () => {
  describe('should render with the correct default placeholder values', () => {
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
