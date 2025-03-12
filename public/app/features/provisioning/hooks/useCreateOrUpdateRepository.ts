import { useCallback } from 'react';

import { RepositorySpec, useCreateRepositoryMutation, useReplaceRepositoryMutation } from '../api';

export function useCreateOrUpdateRepository(name?: string) {
  const [create, createRequest] = useCreateRepositoryMutation();
  const [update, updateRequest] = useReplaceRepositoryMutation();

  const updateOrCreate = useCallback(
    (data: RepositorySpec) => {
      if (name) {
        return update({ name, repository: { metadata: { name }, spec: data } });
      }
      return create({ repository: { metadata: generateRepositoryMetadata(data), spec: data } });
    },
    [create, name, update]
  );

  return [updateOrCreate, name ? updateRequest : createRequest] as const;
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
