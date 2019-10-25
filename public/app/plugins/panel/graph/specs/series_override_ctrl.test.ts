import '../series_overrides_ctrl';
import { SeriesOverridesCtrl } from '../series_overrides_ctrl';

describe('SeriesOverridesCtrl', () => {
  const popoverSrv = {};
  let $scope: any;

  beforeEach(() => {
    $scope = {
      ctrl: {
        refresh: jest.fn(),
        render: jest.fn(),
        seriesList: [],
      },
      render: jest.fn(() => {}),
    };
    SeriesOverridesCtrl($scope, {} as JQuery, popoverSrv);
  });

  describe('When setting an override', () => {
    beforeEach(() => {
      $scope.setOverride({ propertyName: 'lines' }, { value: true });
    });

    it('should set override property', () => {
      expect($scope.override.lines).toBe(true);
    });

    it('should update view model', () => {
      expect($scope.currentOverrides[0].name).toBe('Lines');
      expect($scope.currentOverrides[0].value).toBe('true');
    });
  });

  describe('When removing overide', () => {
    it('click should include option and value index', () => {
      $scope.setOverride(1, 0);
      $scope.removeOverride({ propertyName: 'lines' });
      expect($scope.currentOverrides.length).toBe(0);
    });
  });
});
