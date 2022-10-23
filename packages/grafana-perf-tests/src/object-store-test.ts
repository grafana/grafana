import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { b64encode } from 'k6/encoding';
import execution from 'k6/execution';
import grpc from 'k6/net/grpc';

import { Data, prepareData } from './prepare-data';

const client = new grpc.Client();
const grpcToken = __ENV.GRPC_TOKEN;
const grpcAddress = __ENV.GRPC_ADDRESS;

const data: Data = new SharedArray('data', () => {
  return [prepareData(JSON.parse(open('../scripts/tmp/filenames.json')), 100)];
})[0];

const scenarioDuration = '15s';

export const options = {
  setupTimeout: '5m',
  noConnectionReuse: true,
  scenarios: {
    writer: {
      exec: 'writer',
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '2s',
      duration: scenarioDuration,
      preAllocatedVUs: 1,
      maxVUs: 10,
    },
    reader: {
      exec: 'reader',
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '2s', // 1000 iterations per second, i.e. 1000 RPS
      duration: scenarioDuration,
      preAllocatedVUs: 1, // how large the initial pool of VUs would be
      maxVUs: 100, // if th
    },
  },
  // thresholds: { http_req_duration: ['avg<100', 'p(95)<200'] },
};

export function setup() {
  if (typeof grpcToken !== 'string' || !grpcToken.length) {
    throw new Error('GRPC_TOKEN env variable is missing');
  }

  if (typeof grpcAddress !== 'string' || !grpcAddress.length) {
    throw new Error('GRPC_ADDRESS env variable is missing');
  }
  client.connect(grpcAddress, { plaintext: true, reflect: true });

  const response = client.invoke('grpc.health.v1.Health/Check', {});

  check(response, {
    'server is healthy': (r) => {
      const statusOK = r && r.status === grpc.StatusOK;
      if (!statusOK) {
        return false;
      }

      const body = r.message;
      // @ts-ignore
      return 'status' in body && body.status === 'SERVING';
    },
  });

  for (let i = 0; i < data.base.length; i++) {
    const obj = data.base[i];
    const response = client.invoke(
      'object.ObjectStore/Write',
      {
        body: b64encode(JSON.stringify(obj.data)),
        comment: 'hello-world-2',
        kind: obj.kind,
        UID: obj.uid,
      },
      {
        metadata: {
          authorization: `Bearer ${grpcToken}`,
        },
      }
    );

    check(response, {
      'object was created': (r) => {
        const statusOK = r && r.status === grpc.StatusOK;
        if (!statusOK) {
          return false;
        }

        const body = r.message;
        return 'status' in body && body.status === 'CREATED';
      },
    });
  }
}

export function teardown() {
  client.connect(grpcAddress, { plaintext: true, reflect: true });

  const toDelete = [...data.base, ...data.toWrite];
  for (let i = 0; i < toDelete.length; i++) {
    const obj = toDelete[i];
    const response = client.invoke(
      'object.ObjectStore/Delete',
      {
        kind: obj.kind,
        UID: obj.uid,
      },
      {
        metadata: {
          authorization: `Bearer ${grpcToken}`,
        },
      }
    );

    check(response, {
      'object was deleted': (r) => {
        return r && r.status === grpc.StatusOK;
      },
    });
  }
}

export function reader() {
  client.connect(grpcAddress, { plaintext: true, reflect: true });
  const item = data.base[execution.scenario.iterationInTest % data.base.length];
  const response = client.invoke(
    'object.ObjectStore/Read',
    {
      kind: item.kind,
      UID: item.uid,
      with_body: true,
      with_summary: true,
    },
    {
      metadata: {
        authorization: `Bearer ${grpcToken}`,
      },
    }
  );

  check(response, {
    'object exists': (r) => {
      const statusOK = r && r.status === grpc.StatusOK;
      if (!statusOK) {
        return false;
      }

      const body = r.message;
      return 'object' in body && typeof body.object?.body === 'string';
    },
  });
}

export function writer() {
  const item = data.toWrite[execution.scenario.iterationInTest % data.toWrite.length];
  client.connect(grpcAddress, { plaintext: true, reflect: true });

  const randomData = {
    ...item.data,
    __random: Date.now(),
  };
  const response = client.invoke(
    'object.ObjectStore/Write',
    {
      body: b64encode(JSON.stringify(randomData)),
      comment: 'hello-world-2',
      kind: item.kind,
      UID: item.uid,
    },
    {
      metadata: {
        authorization: `Bearer ${grpcToken}`,
      },
    }
  );

  check(response, {
    'object was created or updated': (r) => {
      const statusOK = r && r.status === grpc.StatusOK;
      if (!statusOK) {
        return false;
      }

      const body = r.message;
      // return 'status' in body;
      return 'status' in body && (body.status === 'CREATED' || body.status === 'UPDATED');
    },
  });

  client.close();
}
