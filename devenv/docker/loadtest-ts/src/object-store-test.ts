import { SharedArray } from 'k6/data';
import execution from 'k6/execution';
import grpc from 'k6/net/grpc';

import { GRPCObjectStoreClient } from './object-store-client';
import { Data, prepareData } from './prepare-data';

const grpcToken = __ENV.GRPC_TOKEN;
const grpcAddress = __ENV.GRPC_ADDRESS;

if (typeof grpcToken !== 'string' || !grpcToken.length) {
  throw new Error('GRPC_TOKEN env variable is missing');
}

if (typeof grpcAddress !== 'string' || !grpcAddress.length) {
  throw new Error('GRPC_ADDRESS env variable is missing');
}

const client = new grpc.Client();
const objectStoreClient = new GRPCObjectStoreClient(client, grpcAddress, grpcToken);

const data: Data = new SharedArray('data', () => {
  return [prepareData(JSON.parse(open('../scripts/tmp/filenames.json')), 50)];
})[0];

const scenarioDuration = '2m';

export const options = {
  setupTimeout: '5m',
  teardownTimeout: '5m',
  noConnectionReuse: true,
  scenarios: {
    writer: {
      exec: 'writer',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '2s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 1,
    },
    reader: {
      exec: 'reader',
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '2s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 10,
    },
    writer1mb: {
      exec: 'writer1mb',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '20s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 5,
    },
    reader1mb: {
      startTime: '2s',
      exec: 'reader1mb',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 5,
    },
    writer4mb: {
      exec: 'writer4mb',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '30s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 5,
    },
    reader4mb: {
      startTime: '3s',
      exec: 'reader4mb',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '5s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 5,
    },
  },
  // thresholds: { http_req_duration: ['avg<100', 'p(95)<200'] },
};

export function setup() {
  if (!objectStoreClient.healthCheck()) {
    execution.test.abort('server should be healthy');
  }

  console.log('inserting base objects');
  for (let i = 0; i < data.base.length; i++) {
    if (i % 100 === 0) {
      console.log(`inserted ${i} / ${data.base.length}`);
    }
    objectStoreClient.writeObject(data.base[i], { randomizeData: false, checkCreatedOrUpdated: false });
  }
}

export function teardown() {
  const toDelete = [...data.base, ...data.toWrite, data.size1mb, data.size4mb, data.size100kb];

  console.log('deleting base objects');
  for (let i = 0; i < toDelete.length; i++) {
    if (i % 100 === 0) {
      console.log(`deleted ${i} / ${data.base.length}`);
    }
    objectStoreClient.deleteObject(toDelete[i].uid, toDelete[i].kind);
  }
}

export function reader() {
  const item = data.base[execution.scenario.iterationInTest % data.base.length];
  objectStoreClient.readObject(item.uid, item.kind);
}

export function writer() {
  const item = data.toWrite[execution.scenario.iterationInTest % data.toWrite.length];
  objectStoreClient.writeObject(item, { randomizeData: true, checkCreatedOrUpdated: true });
}

export function writer1mb() {
  objectStoreClient.writeObject(data.size1mb, { randomizeData: true, checkCreatedOrUpdated: true });
}

export function reader1mb() {
  const item = data.size1mb;
  objectStoreClient.readObject(item.uid, item.kind);
}

export function writer4mb() {
  objectStoreClient.writeObject(data.size4mb, { randomizeData: true, checkCreatedOrUpdated: true });
}

export function reader4mb() {
  const item = data.size4mb;
  objectStoreClient.readObject(item.uid, item.kind);
}
