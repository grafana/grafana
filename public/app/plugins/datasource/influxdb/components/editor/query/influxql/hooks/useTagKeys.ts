import { useMemo } from 'react';

import { InfluxQueryTag } from '../../../../../types';

export const useTagKeys = (allTagKeys: Promise<Set<string>>, tags?: InfluxQueryTag[]) => {
  const getTagKeys = useMemo(
    () => async () => {
      const selectedTagKeys = new Set(tags?.map((tag) => tag.key));

      return [...(await allTagKeys)].filter((tagKey) => !selectedTagKeys.has(tagKey));
    },
    [tags, allTagKeys]
  );
  return { getTagKeys };
};
