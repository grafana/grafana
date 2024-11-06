import { VariableHide } from '@grafana/data';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, ConstantVariable, CustomVariable, sceneGraph } from '@grafana/scenes';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { MockDataSourceSrv, mockDataSource } from '../alerting/unified/mocks';
import { activateFullSceneTree } from '../dashboard-scene/utils/test-utils';

import { DataTrail } from './DataTrail';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import {
  MetricSelectedEvent,
  VAR_FILTERS,
  VAR_OTEL_DEPLOYMENT_ENV,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from './shared';

jest.mock('./otel/api', () => ({
  totalOtelResources: jest.fn(() => ({ job: 'oteldemo', instance: 'instance' })),
  getDeploymentEnvironments: jest.fn(() => ['production', 'staging']),
  isOtelStandardization: jest.fn(() => true),
}));

describe('DataTrail', () => {
  beforeAll(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: mockDataSource({
          name: 'Prometheus',
          type: DataSourceType.Prometheus,
        }),
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Given starting non-embedded trail with url sync and no url state', () => {
    let trail: DataTrail;
    const preTrailUrl = '/';

    function getFilterVar() {
      const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error('getFilterVar failed');
    }

    function getStepFilterVar(step: number) {
      const variable = trail.state.history.state.steps[step].trailState.$variables?.getByName(VAR_FILTERS);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error(`getStepFilterVar failed for step ${step}`);
    }

    beforeEach(() => {
      trail = new DataTrail({});
      locationService.push(preTrailUrl);
      activateFullSceneTree(trail);
    });

    it('Should default to metric select scene', () => {
      expect(trail.state.topScene).toBeInstanceOf(MetricSelectScene);
    });

    it('Should set history current step to 1', () => {
      expect(trail.state.history.state.currentStep).toBe(1);
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
        expect(trail.getUrlState().metric).toBe('metric_bucket');
      });

      it('should add history step', () => {
        expect(trail.state.history.state.steps[1].type).toBe('metric_page');
      });

      it('Should set history currentStep to 2', () => {
        expect(trail.state.history.state.currentStep).toBe(2);
      });

      it('Should set history step 1 parentIndex to 0', () => {
        expect(trail.state.history.state.steps[1].parentIndex).toBe(0);
      });

      it('Should have time range `from` be default "now-6h"', () => {
        expect(trail.state.$timeRange?.state.from).toBe('now-6h');
      });

      describe('And browser back button is pressed', () => {
        locationService.getHistory().goBack();

        it('Should return to original URL', () => {
          const { pathname } = locationService.getLocation();
          expect(pathname).toEqual(preTrailUrl);
        });
      });

      describe('And when changing the time range `from` to "now-1h"', () => {
        beforeEach(() => {
          trail.state.$timeRange?.setState({ from: 'now-1h' });
        });

        it('should add history step', () => {
          expect(trail.state.history.state.steps[3].type).toBe('time');
        });

        it('Should set history currentStep to 3', () => {
          expect(trail.state.history.state.currentStep).toBe(3);
        });

        it('Should set history step 2 parentIndex to 1', () => {
          expect(trail.state.history.state.steps[2].parentIndex).toBe(1);
        });

        it('Should have time range `from` be updated "now-1h"', () => {
          expect(trail.state.$timeRange?.state.from).toBe('now-1h');
        });

        it('Previous history step should have previous default `from` of "now-6h"', () => {
          expect(trail.state.history.state.steps[1].trailState.$timeRange?.state.from).toBe('now-6h');
        });

        it('Current history step should have new `from` of "now-1h"', () => {
          expect(trail.state.history.state.steps[3].trailState.$timeRange?.state.from).toBe('now-1h');
        });

        describe('And when traversing back to step 1', () => {
          beforeEach(() => {
            trail.state.history.goBackToStep(1);
          });

          it('Should set history currentStep to 1', () => {
            expect(trail.state.history.state.currentStep).toBe(1);
          });

          it('should sync state with url', () => {
            expect(locationService.getSearchObject().from).toBe('now-6h');
          });

          it('Should have time range `from` be set back to "now-6h"', () => {
            expect(trail.state.$timeRange?.state.from).toBe('now-6h');
          });

          describe('And then when changing the time range `from` to "now-15m"', () => {
            beforeEach(() => {
              trail.state.$timeRange?.setState({ from: 'now-15m' });
            });

            it('should add history step', () => {
              expect(trail.state.history.state.steps[3].type).toBe('time');
            });

            it('Should set history currentStep to 4', () => {
              expect(trail.state.history.state.currentStep).toBe(4);
            });

            it('Should set history step 4 parentIndex to 1', () => {
              expect(trail.state.history.state.steps[4].parentIndex).toBe(1);
            });

            it('Should have time range `from` be updated "now-15m"', () => {
              expect(trail.state.$timeRange?.state.from).toBe('now-15m');
            });

            it('History step 1 (parent) should have previous default `from` of "now-6h"', () => {
              expect(trail.state.history.state.steps[1].trailState.$timeRange?.state.from).toBe('now-6h');
            });

            it('History step 2 should still have `from` of "now-1h"', () => {
              expect(trail.state.history.state.steps[3].trailState.$timeRange?.state.from).toBe('now-1h');
            });

            describe('And then when returning again to step 1', () => {
              beforeEach(() => {
                trail.state.history.goBackToStep(1);
              });

              it('Should set history currentStep to 1', () => {
                expect(trail.state.history.state.currentStep).toBe(1);
              });

              it('should sync state with url', () => {
                expect(locationService.getSearchObject().from).toBe('now-6h');
              });

              it('History step 1 (parent) should have previous default `from` of "now-6h"', () => {
                expect(trail.state.history.state.steps[1].trailState.$timeRange?.state.from).toBe('now-6h');
              });

              it('History step 3 should still have `from` of "now-1h"', () => {
                expect(trail.state.history.state.steps[3].trailState.$timeRange?.state.from).toBe('now-1h');
              });

              it('History step 4 should still have `from` of "now-15m"', () => {
                expect(trail.state.history.state.steps[4].trailState.$timeRange?.state.from).toBe('now-15m');
              });

              it('Should have time range `from` be set back to "now-6h"', () => {
                expect(trail.state.$timeRange?.state.from).toBe('now-6h');
              });
            });
          });
        });
      });

      it('Should have default empty filter', () => {
        expect(getFilterVar().state.filters.length).toBe(0);
      });

      describe('And when changing the filter to zone=a', () => {
        beforeEach(() => {
          getFilterVar().setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
        });

        it('should add history step', () => {
          expect(trail.state.history.state.steps[3].type).toBe('filters');
        });

        it('Should set history currentStep to 3', () => {
          expect(trail.state.history.state.currentStep).toBe(3);
        });

        it('Should set history step 2 parentIndex to 1', () => {
          expect(trail.state.history.state.steps[2].parentIndex).toBe(1);
        });

        it('Should have filter be updated to "zone=a"', () => {
          expect(getFilterVar().state.filters[0].key).toBe('zone');
          expect(getFilterVar().state.filters[0].value).toBe('a');
        });

        it('Previous history step should have empty filter', () => {
          expect(getStepFilterVar(1).state.filters.length).toBe(0);
        });

        it('Current history step should have new filter zone=a', () => {
          expect(getStepFilterVar(3).state.filters[0].key).toBe('zone');
          expect(getStepFilterVar(3).state.filters[0].value).toBe('a');
        });

        describe('And when traversing back to step 1', () => {
          beforeEach(() => {
            trail.state.history.goBackToStep(1);
          });

          it('Should set history currentStep to 1', () => {
            expect(trail.state.history.state.currentStep).toBe(1);
          });

          it('should sync state with url', () => {
            expect(locationService.getSearchObject()['var-filters']).toBe('');
          });

          it('Should have filters set back to empty', () => {
            expect(getFilterVar().state.filters.length).toBe(0);
          });

          describe('And when changing the filter to zone=b', () => {
            beforeEach(() => {
              getFilterVar().setState({ filters: [{ key: 'zone', operator: '=', value: 'b' }] });
            });

            it('should add history step', () => {
              expect(trail.state.history.state.steps[3].type).toBe('filters');
            });

            it('Should set history currentStep to 4', () => {
              expect(trail.state.history.state.currentStep).toBe(4);
            });

            it('Should set history step 4 parentIndex to 1', () => {
              expect(trail.state.history.state.steps[4].parentIndex).toBe(1);
            });

            it('Should have filter be updated to "zone=b"', () => {
              expect(getFilterVar().state.filters[0].key).toBe('zone');
              expect(getFilterVar().state.filters[0].value).toBe('b');
            });

            it('Parent history step 1 should still have empty filter', () => {
              expect(getStepFilterVar(1).state.filters.length).toBe(0);
            });

            it('History step 3 should still have old filter zone=a', () => {
              expect(getStepFilterVar(3).state.filters[0].key).toBe('zone');
              expect(getStepFilterVar(3).state.filters[0].value).toBe('a');
            });

            it('Current history step 4 should have new filter zone=b', () => {
              expect(getStepFilterVar(4).state.filters[0].key).toBe('zone');
              expect(getStepFilterVar(4).state.filters[0].value).toBe('b');
            });

            describe('And then when returning again to step 1', () => {
              beforeEach(() => {
                trail.state.history.goBackToStep(1);
              });

              it('Should set history currentStep to 1', () => {
                expect(trail.state.history.state.currentStep).toBe(1);
              });

              it('should sync state with url', () => {
                expect(locationService.getSearchObject()['var-filters']).toBe('');
              });

              it('Should have filters set back to empty', () => {
                expect(getFilterVar().state.filters.length).toBe(0);
              });

              it('History step 1 should still have empty filter', () => {
                expect(getStepFilterVar(1).state.filters.length).toBe(0);
              });

              it('History step 3 should still have old filter zone=a', () => {
                expect(getStepFilterVar(3).state.filters[0].key).toBe('zone');
                expect(getStepFilterVar(3).state.filters[0].value).toBe('a');
              });

              it('History step 4 should have new filter zone=b', () => {
                expect(getStepFilterVar(4).state.filters[0].key).toBe('zone');
                expect(getStepFilterVar(4).state.filters[0].value).toBe('b');
              });
            });
          });
        });
      });
    });

    describe('When going back to history step 2', () => {
      beforeEach(() => {
        trail.publishEvent(new MetricSelectedEvent('first_metric'));
        trail.publishEvent(new MetricSelectedEvent('second_metric'));
        trail.state.history.goBackToStep(2);
      });

      it('Should restore state and url', () => {
        expect(trail.state.metric).toBe('first_metric');
        expect(locationService.getSearchObject().metric).toBe('first_metric');
      });

      it('Should set history currentStep to 2', () => {
        expect(trail.state.history.state.currentStep).toBe(2);
      });

      it('Should not create another history step', () => {
        expect(trail.state.history.state.steps.length).toBe(4);
      });

      describe('But then selecting a new metric', () => {
        beforeEach(() => {
          trail.publishEvent(new MetricSelectedEvent('third_metric'));
        });

        it('Should create another history step', () => {
          expect(trail.state.history.state.steps.length).toBe(5);
        });

        it('Should set history current step to 4', () => {
          expect(trail.state.history.state.currentStep).toBe(4);
        });

        it('Should set history step 4 parent index to 2', () => {
          expect(trail.state.history.state.steps[4].parentIndex).toBe(2);
        });

        describe('And browser back button is pressed', () => {
          locationService.getHistory().goBack();

          it('Should return to original URL', () => {
            const { pathname } = locationService.getLocation();
            expect(pathname).toEqual(preTrailUrl);
          });
        });
      });
    });
    describe('When going back to history step 0', () => {
      beforeEach(() => {
        trail.publishEvent(new MetricSelectedEvent('first_metric'));
        trail.publishEvent(new MetricSelectedEvent('second_metric'));
        trail.state.history.goBackToStep(0);
      });

      it('Should remove metric from state and url', () => {
        expect(trail.state.metric).toBe(undefined);

        expect(locationService.getSearchObject().metric).toBe(undefined);
        expect(locationService.getSearch().has('metric')).toBe(false);
      });
    });

    it('Filter should be empty', () => {
      expect(getStepFilterVar(0).state.filters.length).toBe(0);
    });

    describe('And filter is added zone=a', () => {
      beforeEach(() => {
        getFilterVar().setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
      });

      it('Filter of trail should be zone=a', () => {
        expect(getFilterVar().state.filters[0].key).toBe('zone');
        expect(getFilterVar().state.filters[0].value).toBe('a');
      });

      it('Filter of step 2 should be zone=a', () => {
        expect(getStepFilterVar(2).state.filters[0].key).toBe('zone');
        expect(getStepFilterVar(2).state.filters[0].value).toBe('a');
      });

      it('Filter of step 0 should empty', () => {
        expect(getStepFilterVar(0).state.filters.length).toBe(0);
      });

      describe('When returning to step 0', () => {
        beforeEach(() => {
          trail.state.history.goBackToStep(0);
        });

        it('Filter of trail should be empty', () => {
          expect(getFilterVar().state.filters.length).toBe(0);
        });
      });
    });

    it('Time range `from` should be now-6h', () => {
      expect(trail.state.$timeRange?.state.from).toBe('now-6h');
    });

    describe('And time range is changed to now-15m to now', () => {
      beforeEach(() => {
        trail.state.$timeRange?.setState({ from: 'now-15m' });
      });

      it('Time range `from` should be now-15m', () => {
        expect(trail.state.$timeRange?.state.from).toBe('now-15m');
      });

      it('Time range `from` of step 2 should be now-15m', () => {
        expect(trail.state.history.state.steps[2].trailState.$timeRange?.state.from).toBe('now-15m');
      });

      it('Time range `from` of step 1 should be now-6h', () => {
        expect(trail.state.history.state.steps[1].trailState.$timeRange?.state.from).toBe('now-6h');
      });

      describe('When returning to step 0', () => {
        beforeEach(() => {
          trail.state.history.goBackToStep(0);
        });

        it('Time range `from` should be now-6h', () => {
          expect(trail.state.$timeRange?.state.from).toBe('now-6h');
        });
      });
    });
  });

  describe('OTel resources attributes', () => {
    let trail: DataTrail;
    const preTrailUrl =
      '/trail?from=now-1h&to=now&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=k8s_cluster_name%7C%3D%7Cappo11ydev01&var-filters=&refresh=&metricPrefix=all&metricSearch=http&actionView=breakdown&var-groupby=$__all&metric=http_client_duration_milliseconds_bucket';

    function getOtelDepEnvVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, trail);
      if (variable instanceof CustomVariable) {
        return variable;
      }
      throw new Error('getDepEnvVar failed');
    }

    function getOtelJoinQueryVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
      if (variable instanceof ConstantVariable) {
        return variable;
      }
      throw new Error('getDepEnvVar failed');
    }

    function getOtelResourcesVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, trail);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error('getOtelResourcesVar failed');
    }

    function getOtelGroupLeftVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail);
      if (variable instanceof ConstantVariable) {
        return variable;
      }
      throw new Error('getOtelResourcesVar failed');
    }

    beforeEach(() => {
      trail = new DataTrail({});
      locationService.push(preTrailUrl);
      activateFullSceneTree(trail);
      getOtelResourcesVar(trail).setState({ filters: [{ key: 'service_name', operator: '=', value: 'adservice' }] });
      getOtelDepEnvVar(trail).changeValueTo('production');
      getOtelGroupLeftVar(trail).setState({ value: 'attribute1,attribute2' });
    });

    it('should start with hidden dep env variable', () => {
      const depEnvVarHide = getOtelDepEnvVar(trail).state.hide;
      expect(depEnvVarHide).toBe(VariableHide.hideVariable);
    });

    it('should start with hidden otel resources variable', () => {
      const resourcesVarHide = getOtelResourcesVar(trail).state.hide;
      expect(resourcesVarHide).toBe(VariableHide.hideVariable);
    });

    it('should start with hidden otel join query variable', () => {
      const joinQueryVarHide = getOtelJoinQueryVar(trail).state.hide;
      expect(joinQueryVarHide).toBe(VariableHide.hideVariable);
    });

    it('should add history step for when updating the otel resource variable', () => {
      expect(trail.state.history.state.steps[2].type).toBe('resource');
    });

    it('Should have otel resource attribute selected as "service_name=adservice"', () => {
      expect(getOtelResourcesVar(trail).state.filters[0].key).toBe('service_name');
      expect(getOtelResourcesVar(trail).state.filters[0].value).toBe('adservice');
    });

    it('Should have deployment environment selected as "production"', () => {
      expect(getOtelDepEnvVar(trail).getValue()).toBe('production');
    });

    it('should add history step for when updating the dep env variable', () => {
      expect(trail.state.history.state.steps[3].type).toBe('dep_env');
    });

    it('should have a group left variable for resource attributes', () => {
      expect(getOtelGroupLeftVar(trail).state.value).toBe('attribute1,attribute2');
    });
  });
});
