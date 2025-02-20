import { useRegisterActions, useKBar, Action, Priority } from 'kbar';
import { useEffect, useState } from 'react';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { AccessControlAction, useDispatch, useSelector } from 'app/types';

import { splitOpen, splitClose, changeCorrelationEditorDetails } from './state/main';
import { runQueries } from './state/query';
import { isSplit, selectPanes } from './state/selectors';

// FIXME: this should use the new IDs
export const ExploreActions = () => {
  const [actions, setActions] = useState<Action[]>([]);
  const { query } = useKBar();
  const dispatch = useDispatch();
  const panes = useSelector(selectPanes);
  const splitted = useSelector(isSplit);

  const canWriteCorrelations = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);

  useEffect(() => {
    const keys = Object.keys(panes);
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
          dispatch(runQueries({ exploreId: keys[0] }));
        },
        section: exploreSection,
      });
      if (panes[1]) {
        // we should always have the right exploreId if split
        actionsArr.push({
          id: 'explore/run-query-right',
          name: 'Run query (right)',
          keywords: 'query right',
          perform: () => {
            dispatch(runQueries({ exploreId: keys[1] }));
          },
          section: exploreSection,
        });
        actionsArr.push({
          id: 'explore/split-view-close-left',
          name: 'Close split view left',
          keywords: 'split',
          perform: () => {
            dispatch(splitClose(keys[0]));
          },
          section: exploreSection,
        });
        actionsArr.push({
          id: 'explore/split-view-close-right',
          name: 'Close split view right',
          keywords: 'split',
          perform: () => {
            dispatch(splitClose(keys[1]));
          },
          section: exploreSection,
        });
      }
    } else {
      // command palette doesn't know what pane we're in, only show option if not split and no datasource is mixed
      const hasMixed = Object.values(panes).some((pane) => {
        return pane?.datasourceInstance?.uid === MIXED_DATASOURCE_NAME;
      });

      if (config.featureToggles.correlations && canWriteCorrelations && !hasMixed) {
        actionsArr.push({
          id: 'explore/correlations-editor',
          name: 'Correlations editor',
          perform: () => {
            dispatch(changeCorrelationEditorDetails({ editorMode: true }));
            dispatch(runQueries({ exploreId: keys[0] }));
          },
          section: exploreSection,
        });
      }

      actionsArr.push({
        id: 'explore/run-query',
        name: 'Run query',
        keywords: 'query',
        perform: () => {
          dispatch(runQueries({ exploreId: keys[0] }));
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
  }, [panes, splitted, query, dispatch, canWriteCorrelations]);

  useRegisterActions(!query ? [] : actions, [actions, query]);

  return null;
};
