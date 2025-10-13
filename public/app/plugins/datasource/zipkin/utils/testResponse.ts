import { FieldDTO } from '@grafana/data';

import { ZipkinSpan } from '../types';

export const testResponse: ZipkinSpan[] = [
  {
    traceId: '3fa414edcef6ad90',
    id: '3fa414edcef6ad90',
    name: 'HTTP GET - api_traces_traceid',
    timestamp: 1605873894680409,
    duration: 1049141,
    tags: {
      samplerType: 'probabilistic',
      samplerParam: '1',
    },
    localEndpoint: {
      serviceName: 'tempo-querier',
    },
  },
  {
    traceId: '3fa414edcef6ad90',
    id: '0f5c1808567e4403',
    name: '/tempopb.Querier/FindTraceByID',
    parentId: '3fa414edcef6ad90',
    timestamp: 1605873894680587,
    duration: 1847,
    tags: {
      component: 'gRPC',
      spanKind: 'client',
    },
    localEndpoint: {
      serviceName: 'tempo-querier',
    },
  },
];

function toVectors(fields: FieldDTO[]) {
  return fields.map((f) => ({ ...f, values: f.values }));
}

export const testResponseDataFrameFields = toVectors([
  { name: 'traceID', values: ['3fa414edcef6ad90', '3fa414edcef6ad90'] },
  { name: 'spanID', values: ['3fa414edcef6ad90', '0f5c1808567e4403'] },
  { name: 'parentSpanID', values: [undefined, '3fa414edcef6ad90'] },
  { name: 'operationName', values: ['HTTP GET - api_traces_traceid', '/tempopb.Querier/FindTraceByID'] },
  { name: 'serviceName', values: ['tempo-querier', 'tempo-querier'] },
  {
    name: 'serviceTags',
    values: [
      [
        { key: 'cluster', type: 'string', value: 'ops-tools1' },
        { key: 'container', type: 'string', value: 'tempo-query' },
      ],
      [
        { key: 'cluster', type: 'string', value: 'ops-tools1' },
        { key: 'container', type: 'string', value: 'tempo-query' },
      ],
    ],
  },
  { name: 'startTime', values: [1605873894680.409, 1605873894680.587] },
  { name: 'duration', values: [1049.141, 1.847] },
  { name: 'logs', values: [[], []] },
  {
    name: 'tags',
    values: [
      [
        { key: 'sampler.type', type: 'string', value: 'probabilistic' },
        { key: 'sampler.param', type: 'float64', value: 1 },
      ],
      [
        { key: 'component', type: 'string', value: 'gRPC' },
        { key: 'span.kind', type: 'string', value: 'client' },
      ],
    ],
  },
  { name: 'warnings', values: [undefined, undefined] },
  { name: 'stackTraces', values: [undefined, undefined] },
]);

export const testResponseNodesFields = toNodesFrame([
  ['3fa414edcef6ad90', '0f5c1808567e4403'],
  ['tempo-querier', 'tempo-querier'],
  ['HTTP GET - api_traces_traceid', '/tempopb.Querier/FindTraceByID'],
  ['1049.14ms (100%)', '1.85ms (0.18%)'],
  ['1047.29ms (99.82%)', '1.85ms (100%)'],
  [0.9982395121342127, 0.0017604878657873442],
]);

export const testResponseEdgesFields = toEdgesFrame([
  ['3fa414edcef6ad90--0f5c1808567e4403'],
  ['0f5c1808567e4403'],
  ['3fa414edcef6ad90'],
]);

export function toNodesFrame(values: unknown[][]) {
  return toVectors([
    { name: 'id', values: values[0] },
    { name: 'title', values: values[1] },
    { name: 'subtitle', values: values[2] },
    { name: 'mainstat', values: values[3] },
    { name: 'secondarystat', values: values[4] },
    {
      name: 'color',
      config: {
        color: {
          mode: 'continuous-GrYlRd',
        },
      },
      values: values[5],
    },
  ]);
}

export function toEdgesFrame(values: unknown[][]) {
  return toVectors([
    { name: 'id', values: values[0] },
    { name: 'target', values: values[1] },
    { name: 'source', values: values[2] },
  ]);
}
