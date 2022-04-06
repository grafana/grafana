import { FC, useEffect, useState } from 'react';
import { useRegisterActions, useKBar, Action } from 'kbar';
import { useDispatch, useSelector } from 'react-redux';
import { StoreState, ExploreId } from 'app/types';
import { splitOpen, splitClose } from './state/main';
import { isSplit } from './state/selectors';
import { runQueries } from './state/query';

interface Props {
  exploreId: ExploreId;
}

export const ExploreActions: FC<Props> = ({ exploreId }: Props) => {
  const [actions, setActions] = useState<Action[]>([]);
  const { query } = useKBar();
  const dispatch = useDispatch();
  const { splitted } = useSelector((state: StoreState) => {
    const splitted = isSplit(state);
    return {
      splitted,
    };
  });

  useEffect(() => {
    const actionsArr: Action[] = [
      {
        id: 'explore/run-query',
        name: 'Run Query',
        keywords: 'query',
        perform: () => {
          dispatch(runQueries(exploreId));
        },
        section: 'Explore',
      },
    ];

    if (splitted) {
      actionsArr.push({
        id: 'explore/split-view-close',
        name: 'Close split view',
        keywords: 'split',
        perform: () => {
          dispatch(splitClose(exploreId));
        },
        section: 'Explore',
      });
    } else {
      actionsArr.push({
        id: 'explore/split-view-open',
        name: 'Open split view',
        keywords: 'split',
        perform: () => {
          dispatch(splitOpen());
        },
        section: 'Explore',
      });
    }
    setActions(actionsArr);
  }, [exploreId, splitted, query, dispatch]);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return null;
};
