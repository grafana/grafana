import { render, screen } from '@testing-library/react';
import React from 'react';

import { getMockDataSource } from '../__mocks__';

import { DataSourceTestingStatus, Props } from './DataSourceTestingStatus';

const getProps = (partialProps?: Partial<Props>): Props => ({
  testingStatus: {
    status: 'success',
    message: 'Test message',
  },
  exploreUrl: 'http://explore',
  dataSource: getMockDataSource(),
  ...partialProps,
});

describe('<DataSourceTestingStatus />', () => {
  it('should render', () => {
    render(<DataSourceTestingStatus {...getProps()} />);
  });

  it('should render successful message when testing status is a success', () => {
    const props = getProps({
      testingStatus: {
        status: 'success',
        message: 'Data source is definitely working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Alert success')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
  });

  it('should render successful message when testing status is uppercase "OK"', () => {
    const props = getProps({
      testingStatus: {
        status: 'OK',
        message: 'Data source is definitely working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Alert success')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
  });

  it('should render successful message when testing status is lowercase "ok"', () => {
    const props = getProps({
      testingStatus: {
        status: 'ok',
        message: 'Data source is definitely working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Alert success')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
  });

  it('should render error message when testing status is "error"', () => {
    const props = getProps({
      testingStatus: {
        status: 'error',
        message: 'Data source is definitely NOT working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is definitely NOT working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Alert error')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert success')).toThrow();
  });

  it('should render info message when testing status is unknown', () => {
    const props = getProps({
      testingStatus: {
        status: 'something_weird',
        message: 'Data source is working',
      },
    });
    render(<DataSourceTestingStatus {...props} />);

    expect(screen.getByText('Data source is working')).toBeInTheDocument();
    expect(screen.getByTestId('data-testid Alert info')).toBeInTheDocument();
    expect(() => screen.getByTestId('data-testid Alert success')).toThrow();
    expect(() => screen.getByTestId('data-testid Alert error')).toThrow();
  });
});
