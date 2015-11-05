define([
  '../mocks/dashboard-mock',
  './helpers',
  'app/features/idmaps/idMapSrv'
], function(dashboardMock, helpers) {
  'use strict';

  describe('idMapSrv', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['datasourceSrv']));
    beforeEach(ctx.createService('idMapSrv'));

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
      var dash; = dashboardMock.create();

      beforeEach(function() {
        idMap = {};
        ds.mapIdQuery = sinon.stub();
        ds.mapIdQuery.withArgs('id1').returns(ctx.$q.when('value1'));
        ds.mapIdQuery.withArgs('id2').returns(ctx.$q.when('value2'));
        ctx.datasourceSrv.get = sinon.stub().returns(ctx.$q.when(ds));        
      });

      it('should return an idmap based on ids present in series list', function() {
        var seriesList = [{alias:'alias text $map(id1)'}];

        ctx.service.getIdMap(seriesList, dash).then(function(returnedFromPromise) {
          idMap = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(idMap).to.eql({id1:'value1'});
      });

      it('should call the backend once for each unique id', function() {
        var seriesList = [{alias:'$map(id1)'}, {alias:'$map(id1)'}, {alias:'$map(id2)'}];

        ctx.service.getIdMap(seriesList, dash).then(function(returnedFromPromise) {
          idMap = returnedFromPromise;
        });
        ctx.$rootScope.$digest();

        expect(ds.mapIdQuery.calledTwice).to.be(true);
        expect(idMap).to.eql({id1:'value1', id2: 'value2'});
      });

    });
    
  });

});
