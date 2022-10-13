import { check } from 'k6';
import { b64encode } from 'k6/encoding';
import grpc from 'k6/net/grpc';

let client = new grpc.Client();

export default () => {
  const grpcToken = __ENV.GRPC_TOKEN;
  if (typeof grpcToken !== 'string' || !grpcToken.length) {
    throw new Error('GRPC_TOKEN env variable is missing');
  }

  const grpcAddress = __ENV.GRPC_ADDRESS;
  if (typeof grpcAddress !== 'string' || !grpcAddress.length) {
    throw new Error('GRPC_ADDRESS env variable is missing');
  }

  client.connect(grpcAddress, { plaintext: true, reflect: true });

  const dashboard = { createdAt: Date.now() };
  const response = client.invoke(
    'object.ObjectStore/Write',
    {
      body: b64encode(JSON.stringify(dashboard)),
      comment: 'hello-world-2',
      kind: 'dashboard',
      previous_version: '',
      UID: `k6-tests-${Date.now()}-${Math.random()}`,
    },
    {
      metadata: {
        authorization: `Bearer ${grpcToken}`,
      },
    }
  );

  check(response, {
    'status is OK': (r) => {
      const statusOK = r && r.status === grpc.StatusOK;
      if (!statusOK) {
        return false;
      }

      const body = r.message;
      // @ts-ignore
      return 'status' in body && body.status === 'CREATED';
    },
  });

  console.log(JSON.stringify(response.message));

  client.close();
};
