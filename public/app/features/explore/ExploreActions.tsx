import { FC, useEffect, useState } from 'react';
import { useRegisterActions, useKBar, Action } from 'kbar';
import { connect, ConnectedProps } from 'react-redux';
import { StoreState, ExploreId } from 'app/types';
import { splitOpen, splitClose } from './state/main';
import { isSplit } from './state/selectors';
import { runQueries } from './state/query';

interface OwnProps {
  exploreId: ExploreId;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

// class components need a child functional component to use hooks

const ExploreActionsFunction: FC<Props> = ({ exploreId, splitted }: Props) => {
  const [actions, setActions] = useState<Action[]>([]);
  const { query } = useKBar();

  useEffect(() => {
    const actionsArr: Action[] = [
      {
        id: 'explore/run-query',
        name: 'Run Query',
        keywords: 'query',
        perform: () => runQueries(exploreId),
        section: 'Explore',
      },
    ];

    if (splitted) {
      actionsArr.push({
        id: 'explore/split-view-close',
        name: 'Close split view',
        keywords: 'split',
        perform: () => splitClose(exploreId),
        section: 'Explore',
      });
    } else {
      actionsArr.push({
        id: 'explore/split-view-open',
        name: 'Open split view',
        keywords: 'split',
        perform: () => splitOpen(),
        section: 'Explore',
      });
    }

    setActions(actionsArr);
  }, [exploreId, splitted, query]);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return null;
};

const mapStateToProps = (state: StoreState) => {
  return {
    splitted: isSplit(state),
  };
};

const mapDispatchToProps = {
  splitClose,
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const ExploreActions = connector(ExploreActionsFunction);
