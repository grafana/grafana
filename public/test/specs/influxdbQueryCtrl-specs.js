define([
  'helpers',
  'plugins/datasource/influxdb/queryCtrl'
], function(helpers) {
  'use strict';

  describe('InfluxDBQueryCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('InfluxQueryCtrl'));

    beforeEach(function() {
      ctx.scope.target = {};
      ctx.scope.$parent = { get_data: sinon.spy() };

      ctx.scope.datasource = ctx.datasource;
      ctx.scope.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
    });

    describe('init', function() {
      beforeEach(function() {
        ctx.scope.init();
      });

      it('should init tagSegments', function() {
        expect(ctx.scope.tagSegments.length).to.be(1);
      });

      it('should init measurementSegment', function() {
        expect(ctx.scope.measurementSegment.value).to.be('select measurement');
      });
    });

    describe('when first tag segment is updated', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button'}, 0);
      });

      it('should update tag key', function() {
        expect(ctx.scope.target.tags[0].key).to.be('asd');
        expect(ctx.scope.tagSegments[0].type).to.be('key');
      });

      it('should add tagSegments', function() {
        expect(ctx.scope.tagSegments.length).to.be(3);
      });
    });

    describe('when last tag value segment is updated', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button'}, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
      });

      it('should update tag value', function() {
        expect(ctx.scope.target.tags[0].value).to.be('server1');
      });

      it('should add plus button for another filter', function() {
        expect(ctx.scope.tagSegments[3].fake).to.be(true);
      });
    });

    describe('when last tag value segment is updated to regex', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button'}, 0);
        ctx.scope.tagSegmentUpdated({value: '/server.*/', type: 'value'}, 2);
      });

      it('should update operator', function() {
        expect(ctx.scope.tagSegments[1].value).to.be('=~');
      });
    });

    describe('when second tag key is added', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button' }, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
        ctx.scope.tagSegmentUpdated({value: 'key2', type: 'plus-button'}, 3);
      });

      it('should update tag key', function() {
        expect(ctx.scope.target.tags[1].key).to.be('key2');
      });

      it('should add AND segment', function() {
        expect(ctx.scope.tagSegments[3].value).to.be('AND');
      });
    });

    describe('when condition is changed', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button' }, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
        ctx.scope.tagSegmentUpdated({value: 'key2', type: 'plus-button'}, 3);
        ctx.scope.tagSegmentUpdated({value: 'OR', type: 'condition'}, 3);
      });

      it('should update tag condition', function() {
        expect(ctx.scope.target.tags[1].condition).to.be('OR');
      });

      it('should update AND segment', function() {
        expect(ctx.scope.tagSegments[3].value).to.be('OR');
        expect(ctx.scope.tagSegments.length).to.be(7);
      });
    });

    describe('when deleting first tag filter after value is selected', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button' }, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
        ctx.scope.tagSegmentUpdated(ctx.scope.removeTagFilterSegment, 0);
      });

      it('should remove tags', function() {
        expect(ctx.scope.target.tags.length).to.be(0);
      });

      it('should remove all segment after 2 and replace with plus button', function() {
        expect(ctx.scope.tagSegments.length).to.be(1);
        expect(ctx.scope.tagSegments[0].type).to.be('plus-button');
      });
    });

    describe('when deleting second tag value before second tag value is complete', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button' }, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
        ctx.scope.tagSegmentUpdated({value: 'key2', type: 'plus-button'}, 3);
        ctx.scope.tagSegmentUpdated(ctx.scope.removeTagFilterSegment, 4);
      });

      it('should remove all segment after 2 and replace with plus button', function() {
        expect(ctx.scope.tagSegments.length).to.be(4);
        expect(ctx.scope.tagSegments[3].type).to.be('plus-button');
      });
    });

    describe('when deleting second tag value before second tag value is complete', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button' }, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
        ctx.scope.tagSegmentUpdated({value: 'key2', type: 'plus-button'}, 3);
        ctx.scope.tagSegmentUpdated(ctx.scope.removeTagFilterSegment, 4);
      });

      it('should remove all segment after 2 and replace with plus button', function() {
        expect(ctx.scope.tagSegments.length).to.be(4);
        expect(ctx.scope.tagSegments[3].type).to.be('plus-button');
      });
    });

    describe('when deleting second tag value after second tag filter is complete', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.tagSegmentUpdated({value: 'asd', type: 'plus-button' }, 0);
        ctx.scope.tagSegmentUpdated({value: 'server1', type: 'value'}, 2);
        ctx.scope.tagSegmentUpdated({value: 'key2', type: 'plus-button'}, 3);
        ctx.scope.tagSegmentUpdated({value: 'value', type: 'value'}, 6);
        ctx.scope.tagSegmentUpdated(ctx.scope.removeTagFilterSegment, 4);
      });

      it('should remove all segment after 2 and replace with plus button', function() {
        expect(ctx.scope.tagSegments.length).to.be(4);
        expect(ctx.scope.tagSegments[3].type).to.be('plus-button');
      });
    });

    describe('when adding group by', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.groupByTagUpdated({value: 'host', type: 'plus-button' }, 0);
      });

      it('should add group by', function() {
        expect(ctx.scope.target.groupByTags.length).to.be(1);
        expect(ctx.scope.target.groupByTags[0]).to.be('host');
      });

      it('should add another plus button segment', function() {
        expect(ctx.scope.groupBySegments[1].type).to.be('plus-button');
      });
    });

    describe('when removing group by', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.groupByTagUpdated({value: 'host', type: 'plus-button' }, 0);
        ctx.scope.groupByTagUpdated(ctx.scope.removeGroupBySegment, 0);
      });

      it('should add group by', function() {
        expect(ctx.scope.target.groupByTags.length).to.be(0);
      });

      it('should remove segment', function() {
        expect(ctx.scope.groupBySegments.length).to.be(1);
        expect(ctx.scope.groupBySegments[0].type).to.be('plus-button');
      });
    });


  });
});
