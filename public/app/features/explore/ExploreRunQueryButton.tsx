import { useState } from 'react';
import { ConnectedProps, connect } from 'react-redux';

import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Dropdown, Menu, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useSelector } from 'app/types';

import { changeDatasource } from './state/datasource';
import { setQueries } from './state/query';
import { isSplit, selectExploreDSMaps, selectPanesEntries } from './state/selectors';

const mapDispatchToProps = {
  setQueries,
  changeDatasource,
};

const connector = connect(undefined, mapDispatchToProps);

interface ExploreRunQueryButtonProps {
  queries: DataQuery[];
  rootDatasourceUid?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export type Props = ConnectedProps<typeof connector> & ExploreRunQueryButtonProps;

/*
This component does not validate datasources before running them. Root datasource validation should happen outside this component and can pass in an undefined if invalid
If query level validation is done and a query datasource is invalid, pass in disabled = true
*/

export function ExploreRunQueryButton({
  rootDatasourceUid,
  queries,
  disabled = false,
  onClick,
  changeDatasource,
  setQueries,
}: Props) {
  const [openRunQueryButton, setOpenRunQueryButton] = useState(false);
  const isPaneSplit = useSelector(isSplit);
  const exploreActiveDS = useSelector(selectExploreDSMaps);
  const panesEntries = useSelector(selectPanesEntries);

  const isDifferentDatasource = (uid: string, exploreId: string) =>
    !exploreActiveDS.dsToExplore.find((di) => di.datasource.uid === uid)?.exploreIds.includes(exploreId);

  // exploreId on where the query will be ran, and the datasource ID for the item's DS
  const runQueryText = (exploreId: string, dsUid?: string) => {
    // if the datasource or exploreID is undefined, it will be disabled, but give it default query button text
    return dsUid !== undefined && exploreId !== undefined && isDifferentDatasource(dsUid, exploreId)
      ? {
          fallbackText: 'Switch data source and run query',
          translation: t('explore.run-query.switch-datasource-button', 'Switch data source and run query'),
        }
      : {
          fallbackText: 'Run query',
          translation: t('explore.run-query.run-query-button', 'Run query'),
        };
  };

  const runQuery = async (exploreId: string) => {
    const differentDataSource = isDifferentDatasource(rootDatasourceUid!, exploreId);
    if (differentDataSource) {
      await changeDatasource({ exploreId, datasource: rootDatasourceUid! });
    }
    setQueries(exploreId, queries);

    reportInteraction('grafana_explore_query_history_run', {
      queryHistoryEnabled: config.queryHistoryEnabled,
      differentDataSource,
    });
  };

  const runButton = () => {
    const isInvalid = disabled || queries.length === 0 || rootDatasourceUid === undefined;
    if (!isPaneSplit) {
      const exploreId = exploreActiveDS.exploreToDS[0]?.exploreId; // may be undefined if explore is refreshed while the pane is up
      const buttonText = runQueryText(exploreId, rootDatasourceUid);
      return (
        <Button
          variant={'primary'}
          aria-label={buttonText.translation}
          onClick={() => {
            runQuery(exploreId);
            onClick?.();
          }}
          disabled={isInvalid || exploreId === undefined}
        >
          {buttonText.translation}
        </Button>
      );
    } else {
      const menu = (
        <Menu>
          {panesEntries.map((pane, i) => {
            const buttonText = runQueryText(pane[0], rootDatasourceUid);
            const paneLabel =
              i === 0 ? t('explore.run-query.left-pane', 'Left pane') : t('explore.run-query.right-pane', 'Right pane');
            return (
              <Menu.Item
                key={i}
                ariaLabel={buttonText.fallbackText}
                onClick={() => {
                  runQuery(pane[0]);
                  onClick?.();
                }}
                // eslint-disable-next-line @grafana/no-untranslated-strings
                label={`${paneLabel}: ${buttonText.translation}`}
                disabled={isInvalid || pane[0] === undefined}
              />
            );
          })}
        </Menu>
      );

      return (
        <Dropdown onVisibleChange={(state) => setOpenRunQueryButton(state)} placement="bottom-start" overlay={menu}>
          <ToolbarButton
            aria-label={t(
              'explore.explore-run-query-button.run-button.aria-label-run-query-options',
              'Run query options'
            )}
            variant="canvas"
            isOpen={openRunQueryButton}
          >
            {t('explore.run-query.run-query-button', 'Run query')}
          </ToolbarButton>
        </Dropdown>
      );
    }
  };

  return <>{runButton()}</>;
}

export default connector(ExploreRunQueryButton);
