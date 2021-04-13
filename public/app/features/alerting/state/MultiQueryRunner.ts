import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { ApplyFieldOverrideOptions, DataTransformerConfig, dateMath, FieldColorModeId, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { QueryGroupOptions } from '../../../types';
import { first } from 'rxjs/operators';

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
  private subject: ReplaySubject<PanelData[]>;
  private queryRunners: Record<string, PanelQueryRunner>;
  private createRunner: (config: any) => PanelQueryRunner;

  constructor(createRunner?: (config: any) => PanelQueryRunner) {
    this.subject = new ReplaySubject(1);
    this.queryRunners = {};

    if (!createRunner) {
      this.createRunner = () => new PanelQueryRunner(dataConfig);
    } else {
      this.createRunner = createRunner;
    }
  }

  run(queryOptions: QueryGroupOptions) {
    const allQueries = queryOptions.queries.map((query) => {
      const runner = this.getQueryRunner(query.refId);

      const getDataFromRunners = Object.values(this.queryRunners).map((r) =>
        r.getData({ withFieldConfig: false, withTransforms: false })
      );

      combineLatest(getDataFromRunners).pipe(first()).subscribe(this.subject.next);

      return runner.run({
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
    return this.subject.asObservable();
  }

  getQueryRunner(refId: string) {
    if (this.queryRunners[refId]) {
      return this.queryRunners[refId];
    }

    const runner = this.createRunner(dataConfig);
    this.queryRunners[refId] = runner;

    return runner;
  }
}
