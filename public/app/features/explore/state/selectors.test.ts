import { initialExploreState } from './main';
import { selectOrderedExplorePanes } from './selectors';
import { makeExplorePaneState } from './utils';

describe('getOrderedExplorePanes', () => {
  it('returns a panes object with entries in the correct order', () => {
    const selectorResult = selectOrderedExplorePanes({
      explore: {
        ...initialExploreState,
        panes: {
          right: makeExplorePaneState(),
          left: makeExplorePaneState(),
        },
      },
    });

    expect(Object.keys(selectorResult)).toEqual(['left', 'right']);
  });
});
