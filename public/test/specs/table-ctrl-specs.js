define([
  'helpers',
  'panels/table/timeseries/module',
  'panels/table/RAG/module'
], function(helpers) {
  'use strict';

  describe('TableTimePanelCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.table.timeseries'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('TableTimePanelCtrl'));


    it('should transform the data returned by the datasource correctly', function() {
      var timestampColumnName = ctx.scope.timestampColumnName;

      var datasourceInput = {
        data: [
          {
            target: 'Col1',
            datapoints: [
              [200, 1428422180000],
              [300, 1428422180100],
              [500, 1428422180300],
              [500, 1428422180400]
            ]
          },
          {
            target: 'Col2',
            datapoints: [
              [80, 1428422180000],
              [0, 1428422180100],
              [40, 1428422180200],
              [0, 1428422180300]
            ]
          }
        ]
      };


      ctx.scope.dataHandler(datasourceInput);
      ctx.scope.$digest();

      var expectedResult = {
        columnOrder: [timestampColumnName, "Col1", "Col2"],
        values: [
          { timestampColumnName: 1428422180000, Col1: 200, Col2: 80 },
          { timestampColumnName: 1428422180100, Col1: 300, Col2: 0 },
          { timestampColumnName: 1428422180200, Col1: undefined, Col2: 40 }, // col1 had no data at the timestamp, so should be undefined
          { timestampColumnName: 1428422180300, Col1: 500, Col2: 0 },
          { timestampColumnName: 1428422180400, Col1: 500, Col2: undefined } // ditto
        ]
      };

      expect(ctx.scope.tableData.columnOrder).to.eql(expectedResult.columnOrder);

      // deep comaprison of array of objects
      expect(ctx.scope.tableData.values.length).to.eql(expectedResult.values.length);

      // loop in order through each object needed since .eql was not working correctly for array of objects
      for (var i = 0; i < ctx.scope.tableData.values; ++i) {
        expect(ctx.scope.tableData.values[i]).to.eql(expectedResult.values[i]);
      }
    });

  });

  describe('TableRagPanelCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.table.rag'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('TableRagPanelCtrl'));

    it('should transform the data returned by the datasource correctly', function() {

      // target name is composed of the series name and the object version of the grouped by tag
      var datasourceInput = {
        data: [
          {
            target: 'randomThing.lists.maxFunCount {name: tag1}',
            datapoints: [ [ 200, 1429885220822 ] ]
          },
          {
            target: 'randomThing.lists.maxFunCount {name: tag2}',
            datapoints: [ [ 234, 1429885228707 ] ]
          }
        ]
      };

      ctx.scope.dataHandler(datasourceInput);
      ctx.scope.$digest();

      var columnOrder = [ctx.scope.tagColumnName, ctx.scope.tagValueColumnName];
      var row1 = {};
      row1[ctx.scope.tagColumnName] = 'tag1';
      row1[ctx.scope.tagValueColumnName] = 200;
      var row2 = {};
      row2[ctx.scope.tagColumnName] = 'tag2';
      row2[ctx.scope.tagValueColumnName] = 234;

      var expectedResult = {
        columnOrder: columnOrder,
        values: [row1, row2]
      };

      expect(ctx.scope.tableData.columnOrder).to.eql(expectedResult.columnOrder);
      expect(ctx.scope.tableData.values[0][ctx.scope.tagValueColumnName]).to.eql(200);
      expect(ctx.scope.tableData.values[1][ctx.scope.tagValueColumnName]).to.eql(234);
    });
  });

});

