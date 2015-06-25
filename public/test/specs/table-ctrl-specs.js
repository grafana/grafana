define([
  'helpers',
  'panels/table/module'
], function(helpers) {
  'use strict';

  describe('Time Table Testing', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(function() {
      module('grafana.services');
      module('grafana.panels.table');
      ctx.providePhase();
      ctx.createControllerPhase('TablePanelCtrl');
      ctx.scope.panel.inTimeSeriesMode = true;
    });



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

  describe('RAG Table Testing', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(function() {
      module('grafana.services');
      module('grafana.panels.table');
      ctx.providePhase();
      ctx.createControllerPhase('TablePanelCtrl');
      ctx.scope.panel.inTimeSeriesMode = false;
    });


    it('should transform the data returned by the datasource correctly', function() {

      var latestTimestamp = 23423490;
      // target name is composed of the series name and the object version of the grouped by tag
      var datasourceInput = {
        data: [{
            target: 'Server',
            datapoints: [ [ 100, latestTimestamp ] ]
          },
          {
            target: 'Backup Server',
            datapoints: [ [ 50, latestTimestamp ] ]
          }
        ]
      };

      ctx.scope.dataHandler(datasourceInput);
      ctx.scope.$digest();

      var columnOrder = [ctx.scope.panel.ragBaseColumnName, ctx.scope.panel.ragValueColumnName];
      var row1 = {};
      row1[ctx.scope.panel.ragBaseColumnName] = 'Server';
      row1[ctx.scope.panel.ragValueColumnName] = 100;
      var row2 = {};
      row2[ctx.scope.panel.ragBaseColumnName] = 'Backup Server';
      row2[ctx.scope.panel.ragValueColumnName] = 50;

      var expectedResult = {
        columnOrder: columnOrder,
        values: [row1, row2]
      };

      expect(ctx.scope.tableData.columnOrder).to.eql(expectedResult.columnOrder);
      expect(ctx.scope.tableData.values[0][ctx.scope.panel.ragValueColumnName]).to.eql(100);
      expect(ctx.scope.tableData.values[1][ctx.scope.panel.ragValueColumnName]).to.eql(50);
    });
  });

});

