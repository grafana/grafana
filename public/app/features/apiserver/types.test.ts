import { AnnoKeyCreatedBy, Resource } from './types';

interface MyObjSpec {
  value: string;
  count: number;
}

describe('simple typescript tests', () => {
  const val: Resource<MyObjSpec, 'MyObject'> = {
    apiVersion: 'xxx',
    kind: 'MyObject',
    metadata: {
      name: 'A',
      resourceVersion: '1',
      creationTimestamp: '123',
    },
    spec: {
      value: 'a',
      count: 2,
    },
  };

  describe('typescript helper', () => {
    it('read and write annotations', () => {
      expect(val.metadata.annotations?.[AnnoKeyCreatedBy]).toBeUndefined();
      val.metadata.annotations = { 'grafana.app/createdBy': 'me' };
      expect(val.metadata.annotations?.[AnnoKeyCreatedBy]).toBe('me');
    });
  });
});
