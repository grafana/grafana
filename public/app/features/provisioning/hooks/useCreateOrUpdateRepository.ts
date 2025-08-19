import { useCallback } from 'react';

import {
  RepositorySpec,
  useCreateRepositoryMutation,
  useCreateRepositoryTestMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useReplaceRepositoryMutation();
  const [testConfig, testRequest] = useCreateRepositoryTestMutation();

  const updateOrCreate = useCallback(
    async (data: RepositorySpec) => {
      // First test the config and wait for the result
      // unwrap will throw an error if the test fails
      await testConfig({
        // HACK: we need to provide a name to the test configuration
        name: name || 'new',
        body: {
          spec: data,
        },
      }).unwrap();

      // If test passes, proceed with create/update
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
          },
        });
      }
      return create({ repository: { metadata: generateRepositoryMetadata(data), spec: data } });
    },
    [create, name, update, testConfig]
  );

  return [updateOrCreate, name ? updateRequest : createRequest, testRequest] as const;
}

const generateRepositoryMetadata = (data: RepositorySpec) => {
  // We don't know for sure that we can use a normalised name. If we can't, we'll ask the server to generate one for us.
  const normalisedName = data.title.toLowerCase().replaceAll(/[^a-z0-9\-_]+/g, '');

  if (
    crypto.randomUUID && // we might not be in a secure context
    normalisedName && // we need a non-empty string before we check the first character
    normalisedName.charAt(0) >= 'a' && // required to start with a letter to be a valid k8s name
    normalisedName.charAt(0) <= 'z' &&
    normalisedName.replaceAll(/[^a-z]/g, '').length >= 3 // must look sensible to a human
  ) {
    // We still want a suffix, to avoid name collisions.
    const randomBit = crypto.randomUUID().substring(0, 7);
    const shortenedName = normalisedName.substring(0, 63 - 1 - randomBit.length);
    return { name: `${shortenedName}-${randomBit}` };
  } else {
    return { generateName: 'r' };
  }
};
