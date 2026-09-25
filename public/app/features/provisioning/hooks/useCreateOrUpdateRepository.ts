import { useCallback } from 'react';

import { generateUUID } from '@grafana/data';
import {
  type RepositorySpec,
  type SecureValues,
  useCreateRepositoryMutation,
  useCreateRepositoryTestMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';

export type RepositorySecureChanges = Pick<SecureValues, 'token' | 'commitSigningKey'>;

function toSecureValues(secureChanges?: RepositorySecureChanges): SecureValues | undefined {
  const secureEntries: SecureValues = {};
  if (secureChanges?.token) {
    secureEntries.token = secureChanges.token;
  }
  if (secureChanges?.commitSigningKey) {
    secureEntries.commitSigningKey = secureChanges.commitSigningKey;
  }
  return Object.keys(secureEntries).length ? secureEntries : undefined;
}

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useReplaceRepositoryMutation();
  const [testConfig, testRequest] = useCreateRepositoryTestMutation();

  // Validates a config against the same admission checks a real create/update would run,
  // without persisting anything - see the /test subresource. Used while the wizard hasn't
  // decided a repository is worth creating yet (see AuthTypeStep).
  const testOnly = useCallback(
    async (data: RepositorySpec, secureChanges?: RepositorySecureChanges) => {
      await testConfig({
        // HACK: we need to provide a name to the test configuration
        name: name || 'new',
        body: { spec: data, secure: toSecureValues(secureChanges) },
      }).unwrap();
    },
    [name, testConfig]
  );

  const updateOrCreate = useCallback(
    async (data: RepositorySpec, secureChanges?: RepositorySecureChanges) => {
      const secure = toSecureValues(secureChanges);

      // First test the config and wait for the result
      // unwrap will throw an error if the test fails
      await testConfig({
        // HACK: we need to provide a name to the test configuration
        name: name || 'new',
        body: {
          spec: data,
          secure,
        },
      }).unwrap();

      // If test passes, proceed with create/update. update() is a PUT, and the storage
      // layer allows create-on-update, so this also handles "no repository at this name
      // exists yet" - see AllowCreateOnUpdate in pkg/apiserver/registry/generic/strategy.go.
      if (name) {
        return update({
          name,
          repository: {
            metadata: {
              name,
              // TODO? -- replace with patch spec, so the rest of the metadata is not replaced?
              // Can that support optimistic locking? (eg, make sure the RV is the same?)
              finalizers: ['cleanup', 'remove-orphan-resources'],
            },
            spec: data,
            secure,
          },
        });
      }
      return create({ repository: { metadata: generateRepositoryMetadata(data), spec: data, secure } });
    },
    [create, name, update, testConfig]
  );

  return [updateOrCreate, name ? updateRequest : createRequest, testRequest, testOnly] as const;
}

const generateRepositoryMetadata = (data: RepositorySpec) => {
  // We don't know for sure that we can use a normalised name. If we can't, we'll ask the server to generate one for us.
  const normalisedName = data.title.toLowerCase().replaceAll(/[^a-z0-9\-_]+/g, '');

  if (
    normalisedName && // we need a non-empty string before we check the first character
    normalisedName.charAt(0) >= 'a' && // required to start with a letter to be a valid k8s name
    normalisedName.charAt(0) <= 'z' &&
    normalisedName.replaceAll(/[^a-z]/g, '').length >= 3 // must look sensible to a human
  ) {
    // We still want a suffix, to avoid name collisions.
    const randomBit = generateUUID().substring(0, 7);
    const shortenedName = normalisedName.substring(0, 63 - 1 - randomBit.length);
    return { name: `${shortenedName}-${randomBit}` };
  } else {
    return { generateName: 'r' };
  }
};
