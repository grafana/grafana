import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import { InfluxVersion } from '../../../types';

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { createTestProps } from './helpers';

jest.mock('./AdvancedDBConnectionSettings', () => ({
  AdvancedDbConnectionSettings: () => <div data-testid="advanced-db-settings" />,
}));

jest.mock('./InfluxFluxDBConnection', () => ({
  InfluxFluxDBConnection: () => <div data-testid="flux-connection" />,
}));

jest.mock('./InfluxSQLDBConnection', () => ({
  InfluxSQLDBConnection: () => <div data-testid="sql-connection" />,
}));

jest.mock('./InfluxInfluxQLDBConnection', () => ({
  InfluxInfluxQLDBConnection: () => <div data-testid="influxql-connection" />,
}));

describe('DatabaseConnectionSection', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {
      jsonData: {},
      secureJsonData: {},
      secureJsonFields: {},
    },
    mocks: {
      onOptionsChange: onOptionsChangeMock,
    },
  });

  it('shows alert when version is missing', () => {
    render(<DatabaseConnectionSection {...defaultProps} />);
    expect(screen.getByText(/To view connection settings/i)).toBeInTheDocument();
  });

  it('renders Flux connection component when version is Flux', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.Flux },
      },
    };

    render(<DatabaseConnectionSection {...props} />);
    expect(screen.getByTestId('flux-connection')).toBeInTheDocument();
  });

  it('renders InfluxQL connection component when version is InfluxQL', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.InfluxQL },
      },
    };

    render(<DatabaseConnectionSection {...props} />);
    expect(screen.getByTestId('influxql-connection')).toBeInTheDocument();
  });

  it('renders SQL connection component when version is SQL', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.SQL },
      },
    };

    render(<DatabaseConnectionSection {...props} />);
    expect(screen.getByTestId('sql-connection')).toBeInTheDocument();
  });

  it('always renders AdvancedDbConnectionSettings', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { version: InfluxVersion.SQL },
      },
    };

    render(<DatabaseConnectionSection {...props} />);
    expect(screen.getByTestId('advanced-db-settings')).toBeInTheDocument();
  });
});
