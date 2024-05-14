import React, { useState } from 'react';
import { ConnectedProps, connect } from 'react-redux';

import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { Button, Dropdown, Menu, ToolbarButton } from '@grafana/ui';
import { t } from '@grafana/ui/src/utils/i18n';
import { useSelector } from 'app/types';

import { changeDatasource } from '../../state/datasource';
import { setQueries } from '../../state/query';
import { isSplit, selectExploreDSMaps, selectPanesEntries } from '../../state/selectors';

const mapDispatchToProps = {
  setQueries,
  changeDatasource,
};

const connector = connect(undefined, mapDispatchToProps);

interface ActionsCellProps {
  query?: DataQuery;
}

type Props = ConnectedProps<typeof connector> & ActionsCellProps;

function ActionsCell({ query, changeDatasource, setQueries }: Props) {
  const [openRunQueryButton, setOpenRunQueryButton] = useState(false);
  const isPaneSplit = useSelector(isSplit);
  const exploreActiveDS = useSelector(selectExploreDSMaps);
  const panesEntries = useSelector(selectPanesEntries);

  const isDifferentDatasource = (uid: string, exploreId: string) =>
    !exploreActiveDS.dsToExplore.find((di) => di.datasource.uid === uid)?.exploreIds.includes(exploreId);

  // exploreId on where the query will be ran, and the datasource ID for the item's DS
  const runQueryText = (exploreId: string, dsUid?: string) => {
    return dsUid !== undefined && exploreId !== undefined && isDifferentDatasource(dsUid, exploreId)
      ? {
          fallbackText: 'Switch data source and run query',
          translation: t('explore.rich-history-card.switch-datasource-button', 'Switch data source and run query'),
        }
      : {
          fallbackText: 'Run query',
          translation: t('explore.rich-history-card.run-query-button', 'Run query'),
        };
  };

  const runQuery = async (exploreId: string) => {
    const differentDataSource = isDifferentDatasource(query!.datasource!.uid!, exploreId);
    if (differentDataSource) {
      await changeDatasource({ exploreId, datasource: query!.datasource!.uid! });
    }
    setQueries(exploreId, [query!]);

    reportInteraction('grafana_explore_query_history_run', {
      queryHistoryEnabled: config.queryHistoryEnabled,
      differentDataSource,
    });
  };

  const runButton = () => {
    if (!isPaneSplit) {
      const exploreId = exploreActiveDS.exploreToDS[0]?.exploreId; // may be undefined if explore is refreshed while the pane is up
      const buttonText = runQueryText(exploreId, query?.datasource?.uid);
      return (
        <Button
          variant="secondary"
          aria-label={buttonText.translation}
          onClick={() => runQuery(exploreId)}
          disabled={query === undefined || exploreId === undefined || query?.datasource?.uid === undefined}
        >
          {buttonText.translation}
        </Button>
      );
    } else {
      const menu = (
        <Menu>
          {panesEntries.map((pane, i) => {
            const buttonText = runQueryText(pane[0], query?.datasource?.uid);
            const paneLabel =
              i === 0
                ? t('explore.rich-history-card.left-pane', 'Left pane')
                : t('explore.rich-history-card.right-pane', 'Right pane');
            return (
              <Menu.Item
                key={i}
                ariaLabel={buttonText.fallbackText}
                onClick={() => {
                  runQuery(pane[0]);
                }}
                label={`${paneLabel}: ${buttonText.translation}`}
                disabled={query === undefined || pane[0] === undefined || query?.datasource?.uid === undefined}
              />
            );
          })}
        </Menu>
      );

      return (
        <Dropdown onVisibleChange={(state) => setOpenRunQueryButton(state)} placement="bottom-start" overlay={menu}>
          <ToolbarButton aria-label="run query options" variant="canvas" isOpen={openRunQueryButton}>
            {t('explore.rich-history-card.run-query-button', 'Run query')}
          </ToolbarButton>
        </Dropdown>
      );
    }
  };

  return <>{runButton()}</>;
}

export default connector(ActionsCell);
