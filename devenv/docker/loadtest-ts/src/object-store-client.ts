import { check } from 'k6';
import { b64encode } from 'k6/encoding';
import grpc from 'k6/net/grpc';

import { Object } from './prepare-data';

enum GRPCMethods {
  ServerHealth = 'grpc.health.v1.Health/Check',
  ObjectWrite = 'object.ObjectStore/Write',
  ObjectDelete = 'object.ObjectStore/Delete',
  ObjectRead = 'object.ObjectStore/Read',
}

export class GRPCObjectStoreClient {
  private connected = false;
  constructor(private client: grpc.Client, private grpcAddress: string, private grpcToken: string) {}

  connect = () => {
    if (!this.connected) {
      this.client.connect(this.grpcAddress, { plaintext: true, reflect: true });
      this.connected = true;
    }
  };

  grpcRequestParams = () => {
    return {
      metadata: {
        authorization: `Bearer ${this.grpcToken}`,
      },
    };
  };

  healthCheck = (): boolean => {
    this.connect();
    const response = this.client.invoke(GRPCMethods.ServerHealth, {});

    return check(response, {
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
  };

  deleteObject = (uid: string, kind: string, _?: {}) => {
    this.connect();

    const response = this.client.invoke(
      GRPCMethods.ObjectDelete,
      {
        kind: kind,
        UID: uid,
      },
      this.grpcRequestParams()
    );

    check(response, {
      'object was deleted': (r) => {
        const statusOK = r && r.status === grpc.StatusOK;
        if (!statusOK) {
          return false;
        }

        if (!isDeleteObjectResponse(r.message)) {
          console.log(
            JSON.stringify({
              type: 'invalid_delete_response',
              uid: uid,
              kind: kind,
              resp: r,
            })
          );
          return false;
        }

        return true;
      },
    });
  };

  readObject = (uid: string, kind: string, _?: {}) => {
    this.connect();

    const response = this.client.invoke(
      GRPCMethods.ObjectRead,
      {
        kind: kind,
        UID: uid,
        with_body: true,
        with_summary: true,
      },
      this.grpcRequestParams()
    );

    check(response, {
      'object exists': (r) => {
        const statusOK = r && r.status === grpc.StatusOK;
        if (!statusOK) {
          return false;
        }

        const respBody = r.message;
        if (!isReadObjectResponse(respBody)) {
          console.log(
            JSON.stringify({
              type: 'invalid_read_response',
              uid: uid,
              kind: kind,
              resp: r,
            })
          );
          return false;
        }

        return typeof respBody.object.body === 'string';
      },
    });
  };

  writeObject = (object: Object, opts?: { randomizeData?: boolean; checkCreatedOrUpdated?: boolean }) => {
    this.connect();

    const data = opts?.randomizeData
      ? {
          ...object.data,
          __random: `${Date.now() - Math.random()}`,
        }
      : object.data;

    const response = this.client.invoke(
      GRPCMethods.ObjectWrite,
      {
        body: b64encode(JSON.stringify(data)),
        comment: '',
        kind: object.kind,
        UID: object.uid,
      },
      this.grpcRequestParams()
    );

    const checkName = opts?.checkCreatedOrUpdated ? 'object was created or updated' : 'object was created';
    check(response, {
      [checkName]: (r) => {
        const statusOK = r && r.status === grpc.StatusOK;
        if (!statusOK) {
          return false;
        }

        const respBody = r.message;
        if (!isWriteObjectResponse(respBody)) {
          console.log(
            JSON.stringify({
              type: 'invalid_write_response',
              uid: object.uid,
              kind: object.kind,
              resp: r,
            })
          );
          return false;
        }

        return opts?.checkCreatedOrUpdated
          ? respBody.status === WriteObjectResponseStatus.UPDATED ||
              respBody.status === WriteObjectResponseStatus.CREATED
          : respBody.status === WriteObjectResponseStatus.CREATED;
      },
    });
  };
}

type DeleteObjectResponse = {
  OK: boolean;
};

const isDeleteObjectResponse = (resp: object): resp is DeleteObjectResponse => {
  return resp.hasOwnProperty('OK');
};

enum WriteObjectResponseStatus {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
}

type WriteObjectResponse = {
  status: WriteObjectResponseStatus;
};

const isWriteObjectResponse = (resp: object): resp is WriteObjectResponse => {
  return resp.hasOwnProperty('status');
};

type ReadObjectResponse = {
  object: {
    UID: string;
    kind: string;
    body: string;
  };
};

const isReadObjectResponse = (resp: object): resp is ReadObjectResponse => {
  if (!resp.hasOwnProperty('object')) {
    return false;
  }

  // @ts-ignore
  const object = resp.object;
  return Boolean(object && typeof object === 'object' && object.hasOwnProperty('body'));
};
