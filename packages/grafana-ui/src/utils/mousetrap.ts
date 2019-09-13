import Mousetrap from 'mousetrap';

// @ts-ignore
import enableMouseTrapPause from 'mousetrap-pause';
import 'mousetrap-global-bind';

let mousetrapInstance: MousetrapStatic & {
  pause: () => void;
  unpause: () => void;
};

export const getMousetrap = () => {
  if (!mousetrapInstance) {
    mousetrapInstance = enableMouseTrapPause(Mousetrap);
  }

  return mousetrapInstance;
};
