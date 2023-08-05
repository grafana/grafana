import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';
import { customBuilder } from 'app/features/variables/shared/testing/builders';

import { SQLExpression } from '../types';

import { DatasetSelector } from './DatasetSelector';
import { buildMockDatasetSelectorProps, buildMockTableSelectorProps } from './SqlComponents.testHelpers';
import { TableSelector } from './TableSelector';
import { removeQuotesForMultiVariables } from './visual-query-builder/SQLWhereRow';

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

describe('SQLWhereRow', () => {
  it('should remove quotes in a where clause including multi-value variable', () => {
    const exp: SQLExpression = {
      whereString: "hostname IN ('${multiHost}')",
    };

    const multiVar = customBuilder().withId('multiVar').withName('multiHost').build();
    const nonMultiVar = customBuilder().withId('nonMultiVar').withName('host').build();

    multiVar.multi = true;
    nonMultiVar.multi = false;

    const variables = [multiVar, nonMultiVar];

    removeQuotesForMultiVariables(exp, variables);

    expect(exp.whereString).toBe('hostname IN (${multiHost})');
  });

  it('should not remove quotes in a where clause not including a multi-value variable', () => {
    const exp: SQLExpression = {
      whereString: "hostname IN ('${nonMultiHost}')",
    };

    const multiVar = customBuilder().withId('multiVar').withName('multiHost').build();
    const nonMultiVar = customBuilder().withId('nonMultiVar').withName('host').build();

    multiVar.multi = true;
    nonMultiVar.multi = false;

    const variables = [multiVar, nonMultiVar];

    removeQuotesForMultiVariables(exp, variables);

    expect(exp.whereString).toBe("hostname IN ('${nonMultiHost}')");
  });
});
