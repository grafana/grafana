define([
  './helpers',
  'app/features/dashboard/playlistCtrl',
  'app/features/dashboard/playlistSrv',
], function(helpers) {
  'use strict';

  describe('PlaylistCtrl', function() {

    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.core'));
    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.controllers'));
    beforeEach(ctx.providePhase(['PlaylistSrv']));
    beforeEach(ctx.createControllerPhase('PlaylistCtrl'));
    
    describe('when single template variable playlist needs to be created', function() {
      
      it('should generate combinations only for itself', function() {
        var uri = 'db/dashboard';
        var variables = [{"name":"variable1",
                          "options":[{"text":"value1"},{"text":"value2"}]}];
        var combinations = ctx.scope.computeCombinations(uri,variables);
        expect(combinations).to.eql([{uri: 'db/dashboard', list: [{ tagName: 'variable1', tagValue: 'value1' }]},
                                     {uri: 'db/dashboard', list: [{ tagName: 'variable1', tagValue: 'value2' }]}]);
      });

    });

    describe('when multiple template variable playlist needs to be created', function() {

      it('should generate combinations of the two arrays', function() {
        var uri = 'db/dashboard';
        var variables = [{"name":"variable1","options":[{"text":"value1"},{"text":"value2"}]},
                         {"name":"variable2","options":[{"text":"value3"},{"text":"value4"}]}];
        var combinations = ctx.scope.computeCombinations(uri,variables);
        expect(combinations).to.eql(
            [{uri: 'db/dashboard', list: [{ tagName: 'variable2', tagValue: 'value3' },{tagName: 'variable1', tagValue: 'value1'}]},
             {uri: 'db/dashboard', list: [{ tagName: 'variable2', tagValue: 'value4' },{tagName: 'variable1', tagValue: 'value1'}]},
             {uri: 'db/dashboard', list: [{ tagName: 'variable2', tagValue: 'value3' },{tagName: 'variable1', tagValue: 'value2'}]},
             {uri: 'db/dashboard', list: [{ tagName: 'variable2', tagValue: 'value4' },{tagName: 'variable1', tagValue: 'value2'}]}]);

      });

    });

  });

});
