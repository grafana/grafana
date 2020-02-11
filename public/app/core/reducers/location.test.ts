import { reducerTester } from '../../../test/core/redux/reducerTester';
import { initialState, locationReducer, updateLocation } from './location';
import { LocationState } from '../../types';

describe('locationReducer', () => {
  describe('when updateLocation is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LocationState>()
        .givenReducer(locationReducer, { ...initialState, query: { queryParam: 3, queryParam2: 2 } })
        .whenActionIsDispatched(
          updateLocation({
            query: { queryParam: 1 },
            partial: false,
            path: '/api/dashboard',
            replace: false,
            routeParams: { routeParam: 2 },
          })
        )
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.path).toEqual('/api/dashboard');
          expect(resultingState.url).toEqual('/api/dashboard?queryParam=1');
          expect(resultingState.query).toEqual({ queryParam: 1 });
          expect(resultingState.routeParams).toEqual({ routeParam: 2 });
          expect(resultingState.replace).toEqual(false);
          return true;
        });
    });
  });

  describe('when updateLocation is dispatched with replace', () => {
    it('then state should be correct', () => {
      reducerTester<LocationState>()
        .givenReducer(locationReducer, { ...initialState, query: { queryParam: 3, queryParam2: 2 } })
        .whenActionIsDispatched(
          updateLocation({
            query: { queryParam: 1 },
            partial: false,
            path: '/api/dashboard',
            replace: true,
            routeParams: { routeParam: 2 },
          })
        )
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.path).toEqual('/api/dashboard');
          expect(resultingState.url).toEqual('/api/dashboard?queryParam=1');
          expect(resultingState.query).toEqual({ queryParam: 1 });
          expect(resultingState.routeParams).toEqual({ routeParam: 2 });
          expect(resultingState.replace).toEqual(true);
          return true;
        });
    });
  });

  describe('when updateLocation is dispatched with partial', () => {
    it('then state should be correct', () => {
      reducerTester<LocationState>()
        .givenReducer(locationReducer, { ...initialState, query: { queryParam: 3, queryParam2: 2 } })
        .whenActionIsDispatched(
          updateLocation({
            query: { queryParam: 1 },
            partial: true,
            path: '/api/dashboard',
            replace: false,
            routeParams: { routeParam: 2 },
          })
        )
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.path).toEqual('/api/dashboard');
          expect(resultingState.url).toEqual('/api/dashboard?queryParam=1&queryParam2=2');
          expect(resultingState.query).toEqual({ queryParam: 1, queryParam2: 2 });
          expect(resultingState.routeParams).toEqual({ routeParam: 2 });
          expect(resultingState.replace).toEqual(false);
          return true;
        });
    });
  });

  describe('when updateLocation is dispatched without query', () => {
    it('then state should be correct', () => {
      reducerTester<LocationState>()
        .givenReducer(locationReducer, { ...initialState, query: { queryParam: 3, queryParam2: 2 } })
        .whenActionIsDispatched(
          updateLocation({
            partial: false,
            path: '/api/dashboard',
            replace: false,
            routeParams: { routeParam: 2 },
          })
        )
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.path).toEqual('/api/dashboard');
          expect(resultingState.url).toEqual('/api/dashboard?queryParam=3&queryParam2=2');
          expect(resultingState.query).toEqual({ queryParam: 3, queryParam2: 2 });
          expect(resultingState.routeParams).toEqual({ routeParam: 2 });
          expect(resultingState.replace).toEqual(false);
          return true;
        });
    });
  });

  describe('when updateLocation is dispatched without routeParams', () => {
    it('then state should be correct', () => {
      reducerTester<LocationState>()
        .givenReducer(locationReducer, {
          ...initialState,
          query: { queryParam: 3, queryParam2: 2 },
          routeParams: { routeStateParam: 4 },
        })
        .whenActionIsDispatched(
          updateLocation({
            query: { queryParam: 1 },
            partial: false,
            path: '/api/dashboard',
            replace: false,
          })
        )
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.path).toEqual('/api/dashboard');
          expect(resultingState.url).toEqual('/api/dashboard?queryParam=1');
          expect(resultingState.query).toEqual({ queryParam: 1 });
          expect(resultingState.routeParams).toEqual({ routeStateParam: 4 });
          expect(resultingState.replace).toEqual(false);
          return true;
        });
    });
  });

  describe('when updateLocation is dispatched without path', () => {
    it('then state should be correct', () => {
      reducerTester<LocationState>()
        .givenReducer(locationReducer, {
          ...initialState,
          query: { queryParam: 3, queryParam2: 2 },
          path: '/api/state/path',
        })
        .whenActionIsDispatched(
          updateLocation({
            query: { queryParam: 1 },
            partial: false,
            replace: false,
            routeParams: { routeParam: 2 },
          })
        )
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.path).toEqual('/api/state/path');
          expect(resultingState.url).toEqual('/api/state/path?queryParam=1');
          expect(resultingState.query).toEqual({ queryParam: 1 });
          expect(resultingState.routeParams).toEqual({ routeParam: 2 });
          expect(resultingState.replace).toEqual(false);
          return true;
        });
    });
  });
});
