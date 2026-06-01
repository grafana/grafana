import { type Observable, of, merge } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  type DataSourceWithQueryExportSupport,
  type AbstractQuery,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataFrame,
  FieldType,
  toDataFrame,
  type DataSourceInstanceSettings,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { doDockerChannelStream } from './streaming';
import { type DockerQuery, type DockerOptions, type DockerContainer, type ContainerOption } from './types';

export default class DockerDatasource
  extends DataSourceWithBackend<DockerQuery, DockerOptions>
  implements DataSourceWithQueryExportSupport<DockerQuery>
{
  type: 'docker';
  url: string;
  name: string;
  withCredentials: boolean;
  basicAuth: string;

  private readonly MAX_POINTS = 500;

  private frameBuffer: Record<string, Map<string, DataFrame>> = {};

  constructor(instanceSettings: DataSourceInstanceSettings<DockerOptions>) {
    super(instanceSettings);

    this.type = 'docker';
    this.url = instanceSettings.url || '';
    this.name = instanceSettings.name;
    this.withCredentials = instanceSettings.withCredentials || false;
    this.basicAuth = instanceSettings.basicAuth || '';

    instanceSettings.jsonData = instanceSettings.jsonData || {};
  }

  query(options: DataQueryRequest<DockerQuery>): Observable<DataQueryResponse> {
    const targets = options.targets.filter((t) => !t.hide);

    if (targets.length === 0) {
      return of({ data: [] });
    }

    const observables = targets.map((target) => {
      if (target.resourceType === 'container_stats' && target.containerId && target.streaming) {
        return doDockerChannelStream(target, this, options);
      }
      return super.query({ ...options, targets: [target] }).pipe(
        map((res) => {
          const refId = target.refId ?? 'A';
          const merged = target.resourceType === 'container_stats' ? this.mergeIntoBuffer(refId, res.data) : res.data;

          return { ...res, data: merged };
        })
      );
    });
    return merge(...observables);
  }

  private mergeIntoBuffer(refId: string, incoming: DataFrame[]): DataFrame[] {
    if (!this.frameBuffer[refId]) {
      this.frameBuffer[refId] = new Map();
    }

    const buffer = this.frameBuffer[refId];

    incoming.forEach((frame, idx) => {
      const trimmed = this.trimFrame(frame);
      const key = this.getSeriesKey(trimmed, idx);

      const prev = buffer.get(key);

      if (!prev) {
        buffer.set(key, trimmed);
        return;
      }

      buffer.set(key, this.mergeFrames(prev, trimmed));
    });

    return Array.from(buffer.values());
  }

  private getSeriesKey(frame: DataFrame, index: number): string {
    return frame.name ?? `series-${index}`;
  }

  private mergeFrames(a: DataFrame, b: DataFrame): DataFrame {
    const timeA = a.fields.find((f) => f.type === FieldType.time);
    const timeB = b.fields.find((f) => f.type === FieldType.time);

    if (!timeA || !timeB) {
      return a;
    }

    // Convert to arrays safely without type assertions
    const timeValuesA: number[] = [];
    const timeValuesB: number[] = [];

    for (let i = 0; i < timeA.values.length; i++) {
      const val = timeA.values.get(i);
      if (typeof val === 'number') {
        timeValuesA.push(val);
      }
    }

    for (let i = 0; i < timeB.values.length; i++) {
      const val = timeB.values.get(i);
      if (typeof val === 'number') {
        timeValuesB.push(val);
      }
    }

    const allTimes = [...timeValuesA, ...timeValuesB];
    const uniqueTimes = Array.from(new Set(allTimes)).sort((x, y) => x - y);

    const resultFields = a.fields.map((fieldA) => {
      const fieldB = b.fields.find((f) => f.name === fieldA.name);

      if (fieldA.type === FieldType.time) {
        return {
          name: fieldA.name,
          type: FieldType.time,
          values: uniqueTimes,
        };
      }

      const mapA = new Map<number, number | string | boolean | null>();
      const mapB = new Map<number, number | string | boolean | null>();

      const aTimes = timeValuesA;
      const bTimes = timeValuesB;

      // Get values without type assertions
      const aVals: Array<number | string | boolean | null> = [];
      for (let i = 0; i < fieldA.values.length; i++) {
        const val = fieldA.values.get(i);
        aVals.push(val !== undefined ? val : null);
      }

      const bVals: Array<number | string | boolean | null> = [];
      if (fieldB) {
        for (let i = 0; i < fieldB.values.length; i++) {
          const val = fieldB.values.get(i);
          bVals.push(val !== undefined ? val : null);
        }
      }

      for (let i = 0; i < aTimes.length; i++) {
        mapA.set(aTimes[i], aVals[i]);
      }

      for (let i = 0; i < bTimes.length; i++) {
        mapB.set(bTimes[i], bVals[i]);
      }

      const mergedValues = uniqueTimes.map((t) => {
        if (mapB.has(t)) {
          return mapB.get(t);
        }
        if (mapA.has(t)) {
          return mapA.get(t);
        }
        return null;
      });

      return {
        name: fieldA.name,
        type: fieldA.type,
        values: mergedValues,
      };
    });

    for (const fieldB of b.fields) {
      if (resultFields.find((f) => f.name === fieldB.name)) {
        continue;
      }

      if (fieldB.type === FieldType.time) {
        continue;
      }

      resultFields.push({
        name: fieldB.name,
        type: fieldB.type,
        values: fieldB.values.toArray(),
      });
    }

    return toDataFrame({
      name: a.name,
      fields: resultFields,
    });
  }

  private trimFrame(frame: DataFrame): DataFrame {
    const length = frame.length;

    if (length <= this.MAX_POINTS) {
      return frame;
    }

    const start = length - this.MAX_POINTS;

    return toDataFrame({
      name: frame.name,
      fields: frame.fields.map((f) => ({
        name: f.name,
        type: f.type,
        values: f.values.toArray().slice(start),
      })),
    });
  }

  async getContainers(): Promise<ContainerOption[]> {
    // if containers list is too large can cause rendering problems
    // on a later implemetation add pagination to prevent this
    const containers = await this.getResource<DockerContainer[]>('/containers', {});

    return containers.map((c) => ({
      label: c.Names?.[0] ?? c.Id,
      value: c.Id,
    }));
  }

  exportToAbstractQueries(queries: DockerQuery[]): Promise<AbstractQuery[]> {
    return Promise.resolve([]);
  }
}
