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

    it('Should set history current step to 0', () => {
      expect(trail.state.history.state.currentStep).toBe(0);
    });

    it('Should set history step 0 parentIndex to -1', () => {
      expect(trail.state.history.state.steps[0].parentIndex).toBe(-1);
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

      it('Should set history current step to 1', () => {
        expect(trail.state.history.state.currentStep).toBe(1);
      });

      it('Should set history currentStep to 1', () => {
        expect(trail.state.history.state.currentStep).toBe(1);
      });

      it('Should set history step 1 parentIndex to 0', () => {
        expect(trail.state.history.state.steps[1].parentIndex).toBe(0);
      });
    });

    describe('When going back to history step 1', () => {
      beforeEach(() => {
        trail.publishEvent(new MetricSelectedEvent('first_metric'));
        trail.publishEvent(new MetricSelectedEvent('second_metric'));
        trail.state.history.goBackToStep(1);
      });

      it('Should restore state and url', () => {
        expect(trail.state.metric).toBe('first_metric');
        expect(locationService.getSearchObject().metric).toBe('first_metric');
      });

      it('Should set history currentStep to 1', () => {
        expect(trail.state.history.state.currentStep).toBe(1);
      });

      it('Should not create another history step', () => {
        expect(trail.state.history.state.steps.length).toBe(3);
      });

      describe('But then selecting a new metric', () => {
        beforeEach(() => {
          trail.publishEvent(new MetricSelectedEvent('third_metric'));
        });

        it('Should create another history step', () => {
          expect(trail.state.history.state.steps.length).toBe(4);
        });

        it('Should set history current step to 3', () => {
          expect(trail.state.history.state.currentStep).toBe(3);
        });

        it('Should set history step 3 parent index to 1', () => {
          expect(trail.state.history.state.steps[3].parentIndex).toBe(1);
        });
      });
    });
  });
});
