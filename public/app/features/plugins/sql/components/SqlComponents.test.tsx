import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';

import { DatasetSelector } from './DatasetSelector';
import { buildMockDatasetSelectorProps, buildMockTableSelectorProps } from './SqlComponents.testHelpers';
import { TableSelector } from './TableSelector';

beforeEach(() => {
  config.featureToggles.sqlDatasourceDatabaseSelection = true;
});

afterEach(() => {
  config.featureToggles.sqlDatasourceDatabaseSelection = false;
});

describe('DatasetSelector', () => {
  it('should only query the database when needed', async () => {
    const mockProps = buildMockDatasetSelectorProps();
    render(<DatasetSelector {...mockProps} />);

    await waitFor(() => {
      expect(mockProps.db.datasets).toHaveBeenCalled();
    });
  });

  it('should not query the database if Postgres instance, and no preconfigured database', async () => {
    const mockProps = buildMockDatasetSelectorProps({ isPostgresInstance: true });
    render(<DatasetSelector {...mockProps} />);

    await waitFor(() => {
      expect(mockProps.db.datasets).not.toHaveBeenCalled();
    });
  });

  it('should not query the database if preconfigured', async () => {
    const mockProps = buildMockDatasetSelectorProps({ preconfiguredDataset: 'database 1' });
    render(<DatasetSelector {...mockProps} />);

    await waitFor(() => {
      expect(mockProps.db.datasets).not.toHaveBeenCalled();
    });
  });
});

describe('TableSelector', () => {
  it('should only query the database when needed', async () => {
    const mockProps = buildMockTableSelectorProps({ dataset: 'database 1' });
    render(<TableSelector {...mockProps} />);

    await waitFor(() => {
      expect(mockProps.db.tables).toHaveBeenCalled();
    });
  });

  it('should not query the database if no dataset is passed as a prop', async () => {
    const mockProps = buildMockTableSelectorProps();
    render(<TableSelector {...mockProps} />);

    await waitFor(() => {
      expect(mockProps.db.tables).not.toHaveBeenCalled();
    });
  });
});
