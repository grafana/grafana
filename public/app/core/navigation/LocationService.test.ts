import { LocationService } from './LocationService';
import { setLocationService, getLocationService } from '@grafana/runtime';
import createMemoryHistory from 'history/createMemoryHistory';

describe('LocationService', () => {
  beforeEach(() => {
    const history = createMemoryHistory();
    setLocationService(new LocationService(history));
    getLocationService().push({
      pathname: '/test',
      search: 'queryParam1=queryParam1Val',
    });
  });

  describe('partial updates', () => {
    it('should partially update location', () => {
      // when
      getLocationService().partial({
        queryParam: 'queryParamValue',
      });

      // then
      expect(
        getLocationService()
          .getUrlSearchParams()
          .toString()
      ).toEqual('queryParam1=queryParam1Val&queryParam=queryParamValue');
    });

    it('should append queries', () => {
      // given
      getLocationService().push({
        pathname: '/test',
        search: 'queryParam1=queryParam1Val',
      });

      // when
      getLocationService().partial({
        queryParam2: 'queryParam2Val',
      });

      // then
      expect(
        getLocationService()
          .getUrlSearchParams()
          .toString()
      ).toEqual('queryParam1=queryParam1Val&queryParam2=queryParam2Val');
    });

    describe('duplicate queries', () => {
      it('should not create duplicates', () => {
        // when
        getLocationService().partial({
          queryParam1: 'queryParam1Val',
        });

        // then
        expect(
          getLocationService()
            .getUrlSearchParams()
            .toString()
        ).toEqual('queryParam1=queryParam1Val');
      });

      it('should replace updated query param value', () => {
        // when
        getLocationService().partial({
          queryParam1: 'queryParam1ValUpdated',
        });

        // then
        expect(
          getLocationService()
            .getUrlSearchParams()
            .toString()
        ).toEqual('queryParam1=queryParam1ValUpdated');
      });

      it('should remove query param when null or undefined passed', () => {
        // when
        getLocationService().partial({
          queryParam1: null,
        });

        // then
        expect(
          getLocationService()
            .getUrlSearchParams()
            .toString()
        ).toEqual('');
      });

      it('should ignore query param when null or undefined passed', () => {
        // when
        getLocationService().partial({
          queryParam2: null,
        });

        // then
        expect(
          getLocationService()
            .getUrlSearchParams()
            .toString()
        ).toEqual('queryParam1=queryParam1Val');
      });
    });
  });
});
