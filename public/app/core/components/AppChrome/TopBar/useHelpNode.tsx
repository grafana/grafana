import { cloneDeep } from 'lodash';

import { useSelector } from 'app/types/store';

import { enrichHelpItem } from '../MegaMenu/utils';

export function useHelpNode() {
  const navIndex = useSelector((state) => state.navIndex);
  const helpNode = cloneDeep(navIndex['help']);
  return helpNode ? enrichHelpItem(helpNode) : undefined;
}
