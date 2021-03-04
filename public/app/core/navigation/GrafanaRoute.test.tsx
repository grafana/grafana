import React from 'react';
import { render } from '@testing-library/react';
import { GrafanaRoute } from './GrafanaRoute';
import { locationService } from '@grafana/runtime';

describe('GrafanaRoute', () => {
  it('Parses search', () => {
    let capturedProps: any;

    const PageComponent = (props: any) => {
      capturedProps = props;
      return <div />;
    };

    const location = { search: '?query=hello&test=asd' } as any;
    const history = {} as any;
    const match = {} as any;

    render(
      <GrafanaRoute location={location} history={history} match={match} route={{ component: PageComponent } as any} />
    );

    expect(capturedProps.queryParams.query).toBe('hello');
  });

  it('Should clear history forceRouteReload state after route change', () => {
    const renderSpy = jest.fn();

    const route = {
      /* eslint-disable-next-line react/display-name */
      component: () => {
        renderSpy();
        return <div />;
      },
    } as any;

    const history = locationService.getHistory();

    const { rerender } = render(
      <GrafanaRoute location={history.location} history={history} match={{} as any} route={route} />
    );

    expect(renderSpy).toBeCalledTimes(1);
    locationService.replace('/test', true);
    expect(history.location.state).toMatchInlineSnapshot(`
      Object {
        "forceRouteReload": true,
      }
    `);

    rerender(<GrafanaRoute location={history.location} history={history} match={{} as any} route={route} />);

    expect(history.location.state).toMatchInlineSnapshot(`Object {}`);
    expect(renderSpy).toBeCalledTimes(2);
  });
});
