import { cloneDeep } from 'lodash';
import { useMemo } from 'react';

import { NavModelItem } from '@grafana/data';
import { useSelector } from 'app/types/store';

import { getEnrichedHelpItem } from '../MegaMenu/utils';

export function useHelpNode(): NavModelItem | undefined {
  const navIndex = useSelector((state) => state.navIndex);

  const helpNode = useMemo(() => {
    const helpNode = cloneDeep(navIndex['help']);
    return helpNode ? getEnrichedHelpItem(helpNode) : undefined;
  }, [navIndex]);

  return helpNode;
}
