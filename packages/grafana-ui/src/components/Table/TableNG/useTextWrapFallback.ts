import { useLayoutEffect, useMemo, useState } from 'react';

import { type DataFrame, type Field } from '@grafana/data';

import { TABLE } from './constants';
import { type TextWrapFallback } from './types';
import { getDisplayName } from './utils';

function createEpoch(data: DataFrame) {
  return { data, disabledFields: new Set<string>(), pending: new Set<string>() };
}

export function useTextWrapFallback(data: DataFrame): TextWrapFallback {
  let [epoch, setEpoch] = useState(() => createEpoch(data));
  // New results can reuse the schema and value buffers while containing only short values.
  if (epoch.data !== data) {
    epoch = createEpoch(data);
    setEpoch(epoch);
  }

  // Grid height callbacks discover values during child render. Publish their batch before paint,
  // including commits caused only by pagination or expansion, then invalidate dependent caches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (epoch.pending.size > 0) {
      setEpoch({
        data: epoch.data,
        disabledFields: new Set([...epoch.disabledFields, ...epoch.pending]),
        pending: new Set<string>(),
      });
    }
  });

  return useMemo(
    () => ({
      disabledFields: epoch.disabledFields,
      shouldDisable: (field: Field, value: unknown) => {
        const name = getDisplayName(field);
        if (epoch.disabledFields.has(name) || epoch.pending.has(name)) {
          return true;
        }
        if (value != null && String(value).length > TABLE.MAX_WRAP_TEXT_LENGTH) {
          epoch.pending.add(name);
          return true;
        }
        return false;
      },
    }),
    [epoch]
  );
}
