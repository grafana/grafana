import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { useGetOrgUsersForCurrentOrgLookupQuery } from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';

const collator = new Intl.Collator();

export interface OwnerOption {
  /** The `createdBy` value, like `user:<uid>`. */
  value: string;
  label: string;
}

/** Search rows only carry `createdBy` ids, so map them to names with one cached user lookup. */
export function useOwnerNames() {
  const { data } = useGetOrgUsersForCurrentOrgLookupQuery({ limit: 500 }, { skip: !contextSrv.isSignedIn });

  const loginByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of data ?? []) {
      if (user.uid && user.login) {
        map.set(user.uid, user.login);
      }
    }
    return map;
  }, [data]);

  const resolve = useCallback(
    (createdBy: string): string => {
      if (!createdBy) {
        return '';
      }
      const [type, id = ''] = createdBy.split(':', 2);
      if (type === 'user') {
        return id === contextSrv.user.uid ? t('urv.owner.you', 'You') : (loginByUid.get(id) ?? id);
      }
      // Service identities read better as just their name, like "provisioning".
      return id || type;
    },
    [loginByUid]
  );

  const options = useMemo<OwnerOption[]>(() => {
    const you = contextSrv.isSignedIn
      ? [{ value: `user:${contextSrv.user.uid}`, label: t('urv.owner.you', 'You') }]
      : [];
    const others = [...loginByUid.entries()]
      .filter(([uid]) => uid !== contextSrv.user.uid)
      .map(([uid, login]) => ({ value: `user:${uid}`, label: login }))
      .sort((a, b) => collator.compare(a.label, b.label));
    return [...you, ...others];
  }, [loginByUid]);

  return { resolve, options };
}
