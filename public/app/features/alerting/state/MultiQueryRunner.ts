import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { ApplyFieldOverrideOptions, DataTransformerConfig, dateMath, FieldColorModeId, PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { QueryGroupOptions } from '../../../types';
import { combineAll, map } from 'rxjs/operators';

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
  private runnersSubscription: Subscription | undefined;
  private runnersResult: ReplaySubject<Record<string, PanelData>>;
  private queryRunners: Record<string, PanelQueryRunner>;
  private createRunner: (config: any) => PanelQueryRunner;

  constructor(createRunner?: (config: any) => PanelQueryRunner) {
    this.runnersResult = new ReplaySubject(1);
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

  getData(): Observable<Record<string, PanelData>> {
    return this.runnersResult.asObservable();
  }

  destroy(): void {
    if (this.runnersSubscription) {
      this.runnersSubscription.unsubscribe();
    }
    this.runnersResult.complete();
  }

  getQueryRunner(refId: string) {
    if (this.queryRunners[refId]) {
      return this.queryRunners[refId];
    }

    if (this.runnersSubscription) {
      this.runnersSubscription.unsubscribe();
    }

    const subject = new Subject<Observable<PanelData>>();
    this.runnersSubscription = subject
      .pipe(
        combineAll(),
        map((data) => {
          return data.reduce((record: Record<string, PanelData>, panelData) => {
            const refId = panelData.series[0].refId;

            if (!refId) {
              return record;
            }

            record[refId] = panelData;
            return record;
          }, {});
        })
      )
      .subscribe((data) => {
        this.runnersResult.next(data);
      });

    const runner = this.createRunner(dataConfig);
    this.queryRunners[refId] = runner;

    for (const r of Object.values(this.queryRunners)) {
      subject.next(r.getData({ withTransforms: false, withFieldConfig: false }));
    }

    subject.complete();
    return runner;
  }
}
