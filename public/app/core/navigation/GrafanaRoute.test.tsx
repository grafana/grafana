import React from 'react';
import configureStore, { MockStoreEnhanced } from 'redux-mock-store';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import { StoreState } from '../../types';
import { render } from '@testing-library/react';
import { SyncLocationWithRedux } from './GrafanaRoute';
import { RouteComponentProps } from 'react-router-dom';
// TODO[Router]: fix this import to from 'history'
import createMemoryHistory from 'history/createMemoryHistory';

const mockStore = configureStore<StoreState>([thunk]);
const initialState: Partial<StoreState> = {
  location: { url: '', path: '', query: {}, routeParams: {}, replace: false, lastUpdated: 0 },
};

const mockRouteParamsProps = () => {
  const mockHistory = createMemoryHistory();
  const reactRouterMatch: RouteComponentProps<{ a?: string; b?: string }> = {
    match: {
      params: {
        a: 'paramA',
        b: 'paramB',
      },
      isExact: true,
      path: '/',
      url: '/?orgId=1',
    },
    history: mockHistory,
    location: {
      pathname: '/',
      search: '',
      state: {},
      hash: '',
    },
  };

  return reactRouterMatch;
};

const App = (props: { store: MockStoreEnhanced; routeProps: RouteComponentProps<any>; PageComponent: any }) => (
  <Provider store={props.store}>
    <SyncLocationWithRedux {...props.routeProps}>
      <props.PageComponent />
    </SyncLocationWithRedux>
  </Provider>
);

describe('SyncLocationWithRedux', () => {
  it('saves the current location in redux when rendered', () => {
    const store = mockStore(initialState as StoreState);
    const routeProps = mockRouteParamsProps();
    const PageComponent = () => <div />;

    render(<App store={store} routeProps={routeProps} PageComponent={PageComponent} />);

    expect(store.getActions()).toHaveLength(1);
  });

  it('updates location when route props change', () => {
    const store = mockStore(initialState as StoreState);
    const routeProps = mockRouteParamsProps();
    const PageComponent = () => <div />;

    const { rerender } = render(<App store={store} routeProps={routeProps} PageComponent={PageComponent} />);
    expect(store.getActions()).toHaveLength(1);

    const nextRouteProps = mockRouteParamsProps();
    nextRouteProps.match.params.a = 'paramAUpdated';
    rerender(<App store={store} routeProps={nextRouteProps} PageComponent={PageComponent} />);
    expect(store.getActions()).toHaveLength(2);
  });

  it('does not update location when route props does not change', () => {
    const store = mockStore(initialState as StoreState);
    const routeProps = mockRouteParamsProps();
    const PageComponent = () => <div />;

    const { rerender } = render(<App store={store} routeProps={routeProps} PageComponent={PageComponent} />);
    expect(store.getActions()).toHaveLength(1);

    rerender(<App store={store} routeProps={routeProps} PageComponent={PageComponent} />);
    expect(store.getActions()).toHaveLength(1);
  });
});
