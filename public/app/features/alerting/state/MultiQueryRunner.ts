import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { ApplyFieldOverrideOptions, DataTransformerConfig, dateMath, FieldColorModeId, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { combineAll, shareReplay } from 'rxjs/operators';
import { QueryGroupOptions } from '../../../types';

const options: ApplyFieldOverrideOptions = {
  fieldConfig: {
    defaults: {
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
    },
    overrides: [],
  },
  replaceVariables: (v: string) => v,
  theme: config.theme,
};

const dataConfig = {
  getTransformations: () => [] as DataTransformerConfig[],
  getFieldOverrideOptions: () => options,
};

export class MultiQueryRunner {
  private observable: Observable<PanelData[]>;
  private runnersSubject: Subject<Observable<PanelData>>;
  private queryRunners: Record<string, PanelQueryRunner>;
  private createRunner: (config: any) => PanelQueryRunner;

  constructor(createRunner?: (config: any) => PanelQueryRunner) {
    this.runnersSubject = new ReplaySubject(1);
    this.queryRunners = {};

    if (!createRunner) {
      this.createRunner = () => new PanelQueryRunner(dataConfig);
    } else {
      this.createRunner = createRunner;
    }
  }

  run(queryOptions: QueryGroupOptions) {
    const allQueries = queryOptions.queries.map((query) => {
      return this.getQueryRunner(query.refId).run({
        timezone: 'browser',
        timeRange: {
          from: dateMath.parse(query.timeRange!.from)!,
          to: dateMath.parse(query.timeRange!.to)!,
          raw: query.timeRange!,
        },
        maxDataPoints: queryOptions.maxDataPoints ?? 100,
        minInterval: queryOptions.minInterval,
        queries: [query],
        datasource: query.datasource!,
      });
    });

    return Promise.all(allQueries);
  }

  getData(): Observable<PanelData[]> {
    return this.runnersSubject.asObservable();
  }

  getQueryRunner(refId: string) {
    if (this.queryRunners[refId]) {
      return this.queryRunners[refId];
    }

    const runner = this.createRunner(dataConfig);

    this.queryRunners[refId] = runner;
    this.runnersSubject.next(runner.getData({ withTransforms: false, withFieldConfig: false }));
    return runner;
  }
}
