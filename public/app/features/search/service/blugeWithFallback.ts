import { BehaviorSubject, lastValueFrom, Observable } from 'rxjs';

import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  Field,
  getDefaultTimeRange,
  isDataFrame,
} from '@grafana/data/src';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { GrafanaSearcher } from './types';

type BlugeSearcherWithFallbackDeps = {
  blugeSearcher: GrafanaSearcher;
  sqlSearcher: GrafanaSearcher;
};

export class BlugeSearcherWithFallback implements GrafanaSearcher {
  private blugeSearcherIsReady = new BehaviorSubject<boolean>(false);
  private initializing = false;
  private initialized = false;
  private initInterval: ReturnType<typeof setInterval> | undefined;
  private readonly firstValuePromise: Promise<unknown>;

  constructor(private deps: BlugeSearcherWithFallbackDeps) {
    this.firstValuePromise = getGrafanaDatasource().then(async (ds) => {
      const resp = await lastValueFrom(ds.query(this.createSearchReadinessRequest({ stream: false })));
      this.blugeSearcherIsReady.next(this.isReady(resp));
    });

    this.init();
    // workaround.. `getGrafanaLive()` returns undefined for a while at startup
    // this keeps retrying to send the query until `initGrafanaLive()` is called
    this.initInterval = setInterval(() => {
      this.init();
    }, 2000);
  }

  private init = async () => {
    if (this.initializing) {
      return;
    }

    try {
      this.initializing = true;

      if (this.initialized) {
        clearInterval(this.initInterval);
        this.initInterval = undefined;
        return;
      }

      let readinessObservable: Observable<DataQueryResponse> | undefined;
      try {
        const ds = await getGrafanaDatasource();
        readinessObservable = ds.query(this.createSearchReadinessRequest({ stream: true }));
        this.initialized = true;
      } catch (err) {
        // retry
        return;
      }

      readinessObservable.subscribe((resp) => {
        this.blugeSearcherIsReady.next(this.isReady(resp));
      });
    } finally {
      this.initializing = false;
    }
  };

  private isReady = (resp: DataQueryResponse): boolean => {
    const data = resp.data;
    if (!data?.length) {
      return false;
    }

    const firstFrame = data[0];
    if (!isDataFrame(firstFrame) || !firstFrame.length) {
      return false;
    }

    const nameField: Field | undefined = firstFrame.fields.find((f) => f.name === 'is_ready');
    if (!nameField) {
      return false;
    }

    return Boolean(nameField.values.get(0));
  };

  private createSearchReadinessRequest({ stream }: { stream: boolean }): DataQueryRequest<GrafanaQuery> {
    return {
      app: CoreApp.Unknown,
      interval: '',
      intervalMs: 0,
      range: getDefaultTimeRange(),
      requestId: '',
      scopedVars: {},
      startTime: 0,
      timezone: '',
      targets: [
        {
          refId: 'SearchReadiness',
          queryType: GrafanaQueryType.SearchReadiness,
          searchReadiness: { stream },
        },
      ],
    };
  }

  waitForTheFirstSearchReadinessValue = async () => {
    if (this.initialized) {
      return;
    }
    try {
      await this.firstValuePromise;
    } catch (e) {}
  };

  getSortOptions: GrafanaSearcher['getSortOptions'] = async () => {
    await this.waitForTheFirstSearchReadinessValue();
    return this.blugeSearcherIsReady.getValue()
      ? this.deps.blugeSearcher.getSortOptions()
      : this.deps.sqlSearcher.getSortOptions();
  };

  search: GrafanaSearcher['search'] = async (query) => {
    await this.waitForTheFirstSearchReadinessValue();
    return this.blugeSearcherIsReady.getValue()
      ? this.deps.blugeSearcher.search(query)
      : this.deps.sqlSearcher.search(query);
  };

  starred: GrafanaSearcher['starred'] = async (query) => {
    await this.waitForTheFirstSearchReadinessValue();
    return this.blugeSearcherIsReady.getValue()
      ? this.deps.blugeSearcher.starred(query)
      : this.deps.sqlSearcher.starred(query);
  };

  tags: GrafanaSearcher['tags'] = async (query) => {
    await this.waitForTheFirstSearchReadinessValue();
    return this.blugeSearcherIsReady.getValue()
      ? this.deps.blugeSearcher.tags(query)
      : this.deps.sqlSearcher.tags(query);
  };
}
