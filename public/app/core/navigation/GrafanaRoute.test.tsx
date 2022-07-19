import { render } from '@testing-library/react';
import React from 'react';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { setEchoSrv } from '@grafana/runtime';

import { GrafanaContext } from '../context/GrafanaContext';
import { Echo } from '../services/echo/Echo';

import { GrafanaRoute } from './GrafanaRoute';

describe('GrafanaRoute', () => {
  beforeEach(() => {
    setEchoSrv(new Echo());
  });

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
      <GrafanaContext.Provider value={getGrafanaContextMock()}>
        <GrafanaRoute location={location} history={history} match={match} route={{ component: PageComponent } as any} />
      </GrafanaContext.Provider>
    );

    expect(capturedProps.queryParams.query).toBe('hello');
  });
});
