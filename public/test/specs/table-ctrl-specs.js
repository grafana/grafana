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

      var expectedResult = {
        columnOrder: [ 'tagName', 'value' ],
        values: [
          { tagName: 'tag1', value: 200 },
          { tagName: 'tag2', value: 234 }
        ]
      };

      expect(ctx.scope.tableData.columnOrder).to.eql(expectedResult.columnOrder);
      expect(ctx.scope.tableData.values[0].value).to.eql(200);
      expect(ctx.scope.tableData.values[1].value).to.eql(234);
    });
  });

});

