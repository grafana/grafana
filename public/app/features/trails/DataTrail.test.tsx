import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { getUrlSyncManager } from '@grafana/scenes';

import { MockDataSourceSrv, mockDataSource } from '../alerting/unified/mocks';
import { DataSourceType } from '../alerting/unified/utils/datasource';
import { activateFullSceneTree } from '../dashboard-scene/utils/test-utils';

import { DataTrail } from './DataTrail';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelectScene';
import { MetricSelectedEvent } from './shared';

describe('DataTrail', () => {
  beforeAll(() => {
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: mockDataSource({
          name: 'Prometheus',
          type: DataSourceType.Prometheus,
        }),
      })
    );
  });

  describe('Given starting trail with url sync and no url state', () => {
    let trail: DataTrail;

    beforeEach(() => {
      trail = new DataTrail({});
      locationService.push('/');
      getUrlSyncManager().initSync(trail);
      activateFullSceneTree(trail);
    });

    it('Should default to metric select scene', () => {
      expect(trail.state.topScene).toBeInstanceOf(MetricSelectScene);
    });

    describe('And metric is selected', () => {
      beforeEach(() => {
        trail.publishEvent(new MetricSelectedEvent('metric_bucket'));
      });

      it('should switch scene to MetricScene', () => {
        expect(trail.state.metric).toBe('metric_bucket');
        expect(trail.state.topScene).toBeInstanceOf(MetricScene);
      });

      it('should sync state with url', () => {
        expect(locationService.getSearchObject().metric).toBe('metric_bucket');
      });

      it('should add history step', () => {
        expect(trail.state.history.state.steps[1].type).toBe('metric');
      });
    });

    describe('When going back to history step', () => {
      beforeEach(() => {
        trail.publishEvent(new MetricSelectedEvent('first_metric'));
        trail.publishEvent(new MetricSelectedEvent('second_metric'));
        trail.goBackToStep(trail.state.history.state.steps[1]);
      });

      it('Should restore state and url', () => {
        expect(trail.state.metric).toBe('first_metric');
        expect(trail.state.stepIndex).toBe(1);
        expect(locationService.getSearchObject().metric).toBe('first_metric');
      });

      it('Should not create another history step', () => {
        expect(trail.state.history.state.steps.length).toBe(3);
      });

      it('But selecting a new metric should create another history step', () => {
        trail.publishEvent(new MetricSelectedEvent('third_metric'));
        expect(trail.state.history.state.steps.length).toBe(4);
      });
    });
  });
});
