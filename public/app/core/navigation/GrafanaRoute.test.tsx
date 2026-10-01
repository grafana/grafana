import { screen } from '@testing-library/react';
import { lazy, type ComponentType } from 'react';
import { render } from 'test/test-utils';

import { setEchoSrv } from '@grafana/runtime';

import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, type Props } from './GrafanaRoute';
import { useMTFallback } from './mtFallback';
import { type GrafanaRouteComponentProps } from './types';

jest.mock('./mtFallback', () => ({
  useMTFallback: jest.fn(),
}));

const mockUseMTFallback = jest.mocked(useMTFallback);

const mockLocation = {
  search: '?query=hello&test=asd',
  pathname: '',
  state: undefined,
  hash: '',
};
function setup(overrides: Partial<Props>) {
  const props: Props = {
    location: mockLocation,
    route: {
      path: '/',
      component: () => <div />,
    },
    ...overrides,
  };

  render(<GrafanaRoute {...props} />);
}

describe('GrafanaRoute', () => {
  beforeEach(() => {
    setEchoSrv(new Echo());
    mockUseMTFallback.mockReturnValue(false);
  });

  it('Parses search', () => {
    let capturedProps: GrafanaRouteComponentProps;
    const PageComponent = (props: GrafanaRouteComponentProps) => {
      capturedProps = props;
      return <div />;
    };

    setup({ route: { component: PageComponent, path: '' } });
    expect(capturedProps!.queryParams.query).toBe('hello');
  });

  it('Shows loading on lazy load', async () => {
    const PageComponent = lazy(() => {
      return new Promise<{ default: ComponentType }>(() => {});
    });

    setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByLabelText('Loading')).toBeInTheDocument();
  });

  it('Shows error on page error', async () => {
    const PageComponent = () => {
      throw new Error('Page threw error');
    };

    const consoleError = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(consoleError);

    setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByRole('heading', { name: 'An unexpected error happened' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows the fallback loader instead of the route component when useMTFallback returns true', () => {
    mockUseMTFallback.mockReturnValue(true);

    setup({ route: { component: () => <div data-testid="real-page" />, path: '/' } });

    expect(screen.getByTestId('page-fallback-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('real-page')).not.toBeInTheDocument();
  });
});
