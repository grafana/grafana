import {
  describe,
  beforeEach,
  it,
  expect,
  sinon,
  angularMocks
} from "test/lib/common";
import "../series_overrides_ctrl";
import helpers from "test/specs/helpers";

describe("SeriesOverridesCtrl", function() {
  var ctx = new helpers.ControllerTestContext();
  var popoverSrv = {};

  beforeEach(angularMocks.module("grafana.services"));
  beforeEach(angularMocks.module("grafana.controllers"));

  beforeEach(
    ctx.providePhase({
      popoverSrv: popoverSrv
    })
  );

  beforeEach(
    angularMocks.inject(function($rootScope, $controller) {
      ctx.scope = $rootScope.$new();
      ctx.scope.ctrl = {
        refresh: sinon.spy(),
        render: sinon.spy(),
        seriesList: []
      };
      ctx.scope.render = function() {};
      ctx.controller = $controller("SeriesOverridesCtrl", {
        $scope: ctx.scope
      });
    })
  );

  describe("When setting an override", function() {
    beforeEach(function() {
      ctx.scope.setOverride({ propertyName: "lines" }, { value: true });
    });

    it("should set override property", function() {
      expect(ctx.scope.override.lines).to.be(true);
    });

    it("should update view model", function() {
      expect(ctx.scope.currentOverrides[0].name).to.be("Lines");
      expect(ctx.scope.currentOverrides[0].value).to.be("true");
    });
  });

  describe("When removing overide", function() {
    it("click should include option and value index", function() {
      ctx.scope.setOverride(1, 0);
      ctx.scope.removeOverride({ propertyName: "lines" });
      expect(ctx.scope.currentOverrides.length).to.be(0);
    });
  });
});
