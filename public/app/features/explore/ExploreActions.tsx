import { useRegisterActions, useKBar, Action, Priority } from 'kbar';
import { FC, useEffect, useState } from 'react';

import { ExploreId, useDispatch, useSelector } from 'app/types';

import { splitOpen, splitClose } from './state/main';
import { runQueries } from './state/query';
import { isSplit } from './state/selectors';

interface Props {
  exploreIdLeft: ExploreId;
  exploreIdRight?: ExploreId;
}

export const ExploreActions: FC<Props> = ({ exploreIdLeft, exploreIdRight }: Props) => {
  const [actions, setActions] = useState<Action[]>([]);
  const { query } = useKBar();
  const dispatch = useDispatch();
  const splitted = useSelector(isSplit);

  useEffect(() => {
    const exploreSection = {
      name: 'Explore',
      priority: Priority.HIGH + 1,
    };

    const actionsArr: Action[] = [];

    if (splitted) {
      actionsArr.push({
        id: 'explore/run-query-left',
        name: 'Run query (left)',
        keywords: 'query left',
        perform: () => {
          dispatch(runQueries(exploreIdLeft));
        },
        section: exploreSection,
      });
      if (exploreIdRight) {
        // we should always have the right exploreId if split
        actionsArr.push({
          id: 'explore/run-query-right',
          name: 'Run query (right)',
          keywords: 'query right',
          perform: () => {
            dispatch(runQueries(exploreIdRight));
          },
          section: exploreSection,
        });
        actionsArr.push({
          id: 'explore/split-view-close-left',
          name: 'Close split view left',
          keywords: 'split',
          perform: () => {
            dispatch(splitClose(exploreIdLeft));
          },
          section: exploreSection,
        });
        actionsArr.push({
          id: 'explore/split-view-close-right',
          name: 'Close split view right',
          keywords: 'split',
          perform: () => {
            dispatch(splitClose(exploreIdRight));
          },
          section: exploreSection,
        });
      }
    } else {
      actionsArr.push({
        id: 'explore/run-query',
        name: 'Run query',
        keywords: 'query',
        perform: () => {
          dispatch(runQueries(exploreIdLeft));
        },
        section: exploreSection,
      });
      actionsArr.push({
        id: 'explore/split-view-open',
        name: 'Open split view',
        keywords: 'split',
        perform: () => {
          dispatch(splitOpen());
        },
        section: exploreSection,
      });
    }
    setActions(actionsArr);
  }, [exploreIdLeft, exploreIdRight, splitted, query, dispatch]);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return null;
};
