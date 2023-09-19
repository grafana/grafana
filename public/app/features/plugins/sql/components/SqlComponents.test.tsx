import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { CustomVariableModel, LoadingState, VariableHide } from '@grafana/data';
import { config } from '@grafana/runtime';

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
  function makeVariable(id: string, name: string, multi: boolean): CustomVariableModel {
    return {
      id,
      name,
      multi,
      type: 'custom',
      includeAll: false,
      current: {},
      options: [],
      query: '',
      rootStateKey: null,
      global: false,
      hide: VariableHide.dontHide,
      skipUrlSync: false,
      index: -1,
      state: LoadingState.NotStarted,
      error: null,
      description: null,
    };
  }

  it('should remove quotes in a where clause including multi-value variable', () => {
    const exp: SQLExpression = {
      whereString: "hostname IN ('${multiHost}')",
    };

    const multiVar = makeVariable('multiVar', 'multiHost', true);
    const nonMultiVar = makeVariable('nonMultiVar', 'host', false);

    const variables = [multiVar, nonMultiVar];

    removeQuotesForMultiVariables(exp, variables);

    expect(exp.whereString).toBe('hostname IN (${multiHost})');
  });

  it('should not remove quotes in a where clause including a non-multi variable', () => {
    const exp: SQLExpression = {
      whereString: "hostname IN ('${host}')",
    };

    const multiVar = makeVariable('multiVar', 'multiHost', true);
    const nonMultiVar = makeVariable('nonMultiVar', 'host', false);

    const variables = [multiVar, nonMultiVar];

    removeQuotesForMultiVariables(exp, variables);

    expect(exp.whereString).toBe("hostname IN ('${host}')");
  });

  it('should not remove quotes in a where clause not including any known variables', () => {
    const exp: SQLExpression = {
      whereString: "hostname IN ('${nonMultiHost}')",
    };

    const multiVar = makeVariable('multiVar', 'multiHost', true);
    const nonMultiVar = makeVariable('nonMultiVar', 'host', false);

    const variables = [multiVar, nonMultiVar];

    removeQuotesForMultiVariables(exp, variables);

    expect(exp.whereString).toBe("hostname IN ('${nonMultiHost}')");
  });
});
