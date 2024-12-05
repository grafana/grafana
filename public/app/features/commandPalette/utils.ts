import { type ActionImpl } from 'kbar';

import { CommandPaletteAction } from './types';

export const hasCommandOrLink = (action: ActionImpl) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  Boolean(action.command?.perform || (action as ActionImpl & { url?: string }).url);

export const commandPaletteActionHasSomethingToPerform = (action: CommandPaletteAction) =>
  Boolean(action.perform || action.url);
