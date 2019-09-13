import Mousetrap from 'mousetrap';

// @ts-ignore
import * as enableMouseTrapPaouse from 'mousetrap-pause';
import 'mousetrap-global-bind';

let mousetrapInstance: MousetrapStatic & {
  pause: () => void;
  unpause: () => void;
};

export const getMousetrap = () => {
  if (!mousetrapInstance) {
    mousetrapInstance = enableMouseTrapPaouse(Mousetrap);
  }

  return mousetrapInstance;
};
