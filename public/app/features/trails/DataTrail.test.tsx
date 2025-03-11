import { VariableHide } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { AdHocFiltersVariable, ConstantVariable, sceneGraph } from '@grafana/scenes';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { mockDataSource } from '../alerting/unified/mocks';
import { activateFullSceneTree } from '../dashboard-scene/utils/test-utils';

import { DataTrail } from './DataTrail';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import {
  MetricSelectedEvent,
  VAR_FILTERS,
  VAR_OTEL_AND_METRIC_FILTERS,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from './shared';

jest.mock('./otel/api', () => ({
  totalOtelResources: jest.fn(() => ({ job: 'oteldemo', instance: 'instance' })),
  isOtelStandardization: jest.fn(() => true),
}));

describe('DataTrail', () => {
  beforeAll(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());

    setupDataSources(
      mockDataSource({
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Given starting non-embedded trail with url sync and no url state', () => {
    let trail: DataTrail;
    const preTrailUrl = '/';

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
        expect(getFilterVar(trail).state.filters.length).toBe(0);
      });

      describe('And when changing the filter to zone=a', () => {
        beforeEach(() => {
          getFilterVar(trail).setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
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
          expect(getFilterVar(trail).state.filters[0].key).toBe('zone');
          expect(getFilterVar(trail).state.filters[0].value).toBe('a');
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
            expect(getFilterVar(trail).state.filters.length).toBe(0);
          });

          describe('And when changing the filter to zone=b', () => {
            beforeEach(() => {
              getFilterVar(trail).setState({ filters: [{ key: 'zone', operator: '=', value: 'b' }] });
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
              expect(getFilterVar(trail).state.filters[0].key).toBe('zone');
              expect(getFilterVar(trail).state.filters[0].value).toBe('b');
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
                expect(getFilterVar(trail).state.filters.length).toBe(0);
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
        getFilterVar(trail).setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
      });

      it('Filter of trail should be zone=a', () => {
        expect(getFilterVar(trail).state.filters[0].key).toBe('zone');
        expect(getFilterVar(trail).state.filters[0].value).toBe('a');
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
          expect(getFilterVar(trail).state.filters.length).toBe(0);
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

    // selecting a non promoted resource from VAR_OTEL_AND_METRICS will automatically update the otel resources var
    const nonPromotedOtelResources = ['deployment_environment'];
    const preTrailUrl =
      '/trail?from=now-1h&to=now&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=k8s_cluster_name%7C%3D%7Cappo11ydev01&var-filters=&refresh=&metricPrefix=all&metricSearch=http&actionView=breakdown&var-groupby=$__all&metric=http_client_duration_milliseconds_bucket';

    function getOtelAndMetricsVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error('getOtelAndMetricsVar failed');
    }

    function getOtelJoinQueryVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
      if (variable instanceof ConstantVariable) {
        return variable;
      }
      throw new Error('getOtelJoinQueryVar failed');
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
      throw new Error('getOtelGroupLeftVar failed');
    }

    beforeEach(() => {
      trail = new DataTrail({
        nonPromotedOtelResources,
        // before checking, things should be hidden
        initialOtelCheckComplete: false,
      });
      locationService.push(preTrailUrl);
      activateFullSceneTree(trail);
      getOtelGroupLeftVar(trail).setState({ value: 'attribute1,attribute2' });
    });
    // default otel experience to off
    it('clicking start button should start with OTel off and showing var filters', () => {
      trail.setState({ startButtonClicked: true });
      const otelResourcesHide = getOtelResourcesVar(trail).state.hide;
      const varFiltersHide = getFilterVar(trail).state.hide;
      expect(otelResourcesHide).toBe(VariableHide.hideVariable);
      expect(varFiltersHide).toBe(VariableHide.hideLabel);
    });

    it('should start with hidden otel join query variable', () => {
      const joinQueryVarHide = getOtelJoinQueryVar(trail).state.hide;
      expect(joinQueryVarHide).toBe(VariableHide.hideVariable);
    });

    it('should have a group left variable for resource attributes', () => {
      expect(getOtelGroupLeftVar(trail).state.value).toBe('attribute1,attribute2');
    });

    describe('resetting the OTel experience', () => {
      it('should display with hideLabel var filters and hide VAR_OTEL_AND_METRIC_FILTERS when resetting otel experience', () => {
        trail.resetOtelExperience();
        expect(getFilterVar(trail).state.hide).toBe(VariableHide.hideLabel);
        expect(getOtelAndMetricsVar(trail).state.hide).toBe(VariableHide.hideVariable);
      });

      // it should preserve var filters when it resets
    });

    describe('when otel is on the subscription to Otel and metrics var should update other variables', () => {
      beforeEach(() => {
        trail.setState({ initialOtelCheckComplete: true, useOtelExperience: true });
      });

      it('should automatically update the otel resources var when a non promoted resource has been selected from VAR_OTEL_AND_METRICS', () => {
        getOtelAndMetricsVar(trail).setState({
          filters: [{ key: 'deployment_environment', operator: '=', value: 'production' }],
        });

        const otelResourcesVar = getOtelResourcesVar(trail);
        const otelResourcesFilter = otelResourcesVar.state.filters[0];
        expect(otelResourcesFilter.key).toBe('deployment_environment');
        expect(otelResourcesFilter.value).toBe('production');
      });

      it('should add history step of type "resource" when adding a non promoted otel resource', () => {
        getOtelAndMetricsVar(trail).setState({
          filters: [{ key: 'deployment_environment', operator: '=', value: 'production' }],
        });
        expect(trail.state.history.state.steps[2].type).toBe('resource');
      });

      it('should automatically update the var filters when a promoted resource has been selected from VAR_OTEL_AND_METRICS', () => {
        getOtelAndMetricsVar(trail).setState({ filters: [{ key: 'promoted', operator: '=', value: 'resource' }] });
        const varFilters = getFilterVar(trail).state.filters[0];
        expect(varFilters.key).toBe('promoted');
        expect(varFilters.value).toBe('resource');
      });

      it('should add history step of type "filters" when adding a non promoted otel resource', () => {
        getOtelAndMetricsVar(trail).setState({ filters: [{ key: 'promoted', operator: '=', value: 'resource' }] });
        expect(trail.state.history.state.steps[2].type).toBe('filters');
      });
    });
  });

  describe('Label filters', () => {
    let trail: DataTrail;

    beforeEach(() => {
      trail = new DataTrail({});
    });

    it('should not escape regex metacharacters in label values', () => {
      const filterVar = getFilterVar(trail);
      filterVar.setState({ filters: [{ key: 'app', operator: '=~', value: '.*end' }] }); // matches app=frontend, app=backend, etc.
      expect(filterVar.getValue()).toBe('app=~".*end"');
    });
  });
});

function getFilterVar(trail: DataTrail) {
  const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  if (variable instanceof AdHocFiltersVariable) {
    return variable;
  }
  throw new Error('getFilterVar failed');
}
