import { type ActionImpl } from 'kbar';

import { selectors } from '@grafana/e2e-selectors';

import { CommandPaletteAction } from './types';

export function hasCommandOrLink(action: ActionImpl) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Boolean(action.command?.perform || (action as ActionImpl & { url?: string }).url);
}

export function commandPaletteActionHasSomethingToPerform(action: CommandPaletteAction) {
  return Boolean(action.perform || action.url);
}

function flattenKbarResults(array: Array<string | ActionImpl>) {
  return array.reduce<Array<string | ActionImpl>>((acc, item) => {
    acc.push(item);
    if (typeof item !== 'string' && item.children) {
      acc.push(...flattenKbarResults(item.children));
    }
    return acc;
  }, []);
}

export function getFilteredKbarResultsBasedOnCommandPaletteActions(
  kbarResults: Array<string | ActionImpl>,
  commandPaletteActions: Array<CommandPaletteAction | string>
) {
  const idsSetInCommandPaletteActions = new Set(
    commandPaletteActions.map((item) => (typeof item === 'string' ? item : item.id))
  );
  const filteredResultsCandidate = flattenKbarResults(kbarResults).filter((item) => {
    if (typeof item !== 'string' && idsSetInCommandPaletteActions.has(item.id)) {
      return true;
    }
    if (item === 'Actions') {
      return true;
    }
    return false;
  });
  const filteredResults = filteredResultsCandidate.filter((item, idx) => {
    const isTitleAndLastItem = idx === filteredResultsCandidate.length - 1 && typeof item === 'string';
    const isTitleAndNextItemIsTitleToo =
      typeof item === 'string' && typeof filteredResultsCandidate[idx + 1] === 'string';
    if (isTitleAndLastItem || isTitleAndNextItemIsTitleToo) {
      return false;
    }
    return true;
  });
  return filteredResults;
}

export function getCommandPalettePosition() {
  const input = document.querySelector(`[data-testid="${selectors.components.NavToolbar.commandPaletteTrigger}"]`);
  const inputRightPosition = input?.getBoundingClientRect().right ?? 0;
  const screenWidth = document.body.clientWidth;
  const lateralSpace = screenWidth - inputRightPosition;
  return lateralSpace;
}
