import { DECRYPT_ALLOW_LIST } from '../constants';
import { Secret } from '../types';

export const secretsList: Secret[] = [
  {
    uid: 'secret-uid-1',
    name: 'mocked-test-secret-1',
    description: 'mocked secret description-1',
    decrypters: [DECRYPT_ALLOW_LIST[0]],
    created: new Date().toISOString(),
    labels: [
      { name: 'mocked-label-name-1', value: 'mocked-label-value-1' },
      { name: 'mocked-label-name-2', value: 'mocked-label-value-2' },
    ],
    // This secret must not have a keeper!
  },
  {
    uid: 'secret-uid-2',
    name: 'mocked-test-secret-2',
    description: 'mocked secret description',
    decrypters: [...DECRYPT_ALLOW_LIST],
    created: new Date().toISOString(),
    labels: [
      { name: 'mocked-label-name-1', value: 'mocked-label-value-1' },
      { name: 'mocked-label-name-2', value: 'mocked-label-value-2' },
    ],
    keeper: 'mocked-keeper', // This secret must have a keeper
  },
];
