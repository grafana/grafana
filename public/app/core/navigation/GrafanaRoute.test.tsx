import { screen } from '@testing-library/react';
import { lazy, ComponentType } from 'react';
import { render } from 'test/test-utils';

import { setEchoSrv } from '@grafana/runtime';

import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, Props } from './GrafanaRoute';
import { GrafanaRouteComponentProps } from './types';

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
});
