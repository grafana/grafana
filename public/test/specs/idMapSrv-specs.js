define([
  '../mocks/dashboard-mock',
  './helpers',
  'app/features/idmaps/idMapSrv'
], function(dashboardMock, helpers) {
  'use strict';

  describe('idMapSrv', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['datasourceSrv', 'alertSrv']));
    beforeEach(ctx.createService('idMapSrv'));

    //don't clutter test output with expected error messages
    var consolLog = console.log;
    console.log = function(){};
    after(function(){
      console.log = consolLog;
    });

    describe('when mapping ids', function() {
      var idmap = { id1: 'value1', id2: 'value2' };

      it('should accept an idmap as input', function() {
        var outputText = ctx.service.replaceID('output text $map(id1)', idmap);
        expect(outputText).to.be('output text value1');
      });

      it('should be able to map multiple occurences of ids on a single string', function() {
        var outputText = ctx.service.replaceID('output text $map(id1), $map(id1), $map(id2)', idmap);
        expect(outputText).to.be('output text value1, value1, value2');
      });
    });

    describe('when fetching ids for series aliases', function() {
      var ds = {};
      var idMap;
      var ctrl = dashboardMock.create().idMapping;

      beforeEach(function() {
        idMap = {};
        ds.mapIdQuery = sinon.stub();
        ds.mapIdQuery.withArgs('id1').returns(ctx.$q.when('value1'));
        ds.mapIdQuery.withArgs('id2').returns(ctx.$q.when('value2'));
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));
      });

      it('should return an idmap based on ids present in series list', function() {
        var seriesList = [{alias:'alias text $map(id1)'}];

        ctx.service.getSeriesListIdMap(seriesList, ctrl).then(function(returnedFromPromise) {
          idMap = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(idMap).to.eql({id1:'value1'});
      });

      it('should call the backend once for each unique id', function() {
        var seriesList = [{alias:'$map(id1)'}, {alias:'$map(id1)'}, {alias:'$map(id2)'}];

        ctx.service.getSeriesListIdMap(seriesList, ctrl).then(function(returnedFromPromise) {
          idMap = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(ds.mapIdQuery.calledTwice).to.be(true);
        expect(idMap).to.eql({id1:'value1', id2: 'value2'});
      });

    });

    describe('when fetching ids for template variables', function() {
      var ds = {};
      var idMap;
      var ctrl = dashboardMock.create().idMapping;

      beforeEach(function() {
        idMap = {};
        ds.mapIdQuery = sinon.stub();
        ds.mapIdQuery.withArgs('id1').returns(ctx.$q.when('value1'));
        ds.mapIdQuery.withArgs('id2').returns(ctx.$q.when('value2'));
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));
      });

      it('should return an idmap based on ids present in variable values', function() {
        var variable = {options:[{text:'txt',value:'id1'},{text:'txt',value:'id2'}]};

        ctx.service.getTemplateVariableIDMap(variable, ctrl).then(function(returnedFromPromise) {
          idMap = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(idMap).to.eql({id1:'value1', id2: 'value2'});
      });

    });

    describe('when mapping title text IDs', function() {
      var ds = {};
      var idMap;
      var ctrl;
      var text = 'some text $map(id1), $map(id2)';

      beforeEach(function() {
        idMap = {};
        ds.mapIdQuery = sinon.stub();
        ds.mapIdQuery.withArgs('id1').returns(ctx.$q.when('value1'));
        ds.mapIdQuery.withArgs('id2').returns(ctx.$q.when('value2'));
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));
        ctrl = dashboardMock.create().idMapping;
      });

      it('not change the title if mapping is disabled', function() {
        ctrl.enabled = false;

        var returned;
        ctx.service.mapIDsInText(text, ctrl).then(function(returnedFromPromise) {
          returned = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(returned).to.eql(text);
      });

      it('should not call the backend if mapping is disabled', function() {
        ctrl.enabled = false;

        ctx.service.mapIDsInText(text, ctrl);
        ctx.$rootScope.$digest();

        expect(ds.mapIdQuery.called).to.be(false);
      });

      it('should return mapped text with all IDs replaced', function() {
        var returned;
        ctx.service.mapIDsInText(text, ctrl).then(function(returnedFromPromise) {
          returned = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(returned).to.eql('some text value1, value2');
      });

    });

    describe('when replacing IDs not present in the idmap', function() {
      var idMap = {};
      var text = 'some text $map(id1), $map(id2)';
      var returned;

      beforeEach(function() {
        ctx.alertSrv.set = sinon.spy();
        returned = ctx.service.replaceID(text, idMap);
      });

      it('should return the unmapped ID', function() {
        expect(returned).to.eql('some text id1, id2');
      });

      it('should alert once', function() {
        expect(ctx.alertSrv.set.calledOnce).to.be(true);
      });

    });

    describe('When id mapping backend is down', function() {
      var ctrl = dashboardMock.create().idMapping;

      beforeEach(function() {
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.reject("backend down"));
        ctx.service.mapIDsInText("$map(id)", ctrl);
        ctx.$rootScope.$digest();
      });

      it('should give an alert if an id mapping query is done', function() {
        expect(ctx.alertSrv.set.called).to.be(true);
      });

    });

  });

});
