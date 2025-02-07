import { css } from '@emotion/css';
import { ComponentProps, useState } from 'react';

import { Button, ButtonGroup, Dropdown, Menu, ToolbarButton } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';
import { t } from 'app/core/internationalization';

import { createDatasourcesList } from '../../../core/utils/richHistory';
import { useSelector } from '../../../types';
import ExploreRunQueryButton from '../ExploreRunQueryButton';
import { useQueryLibraryContext } from '../QueryLibrary/QueryLibraryContext';
import { QueryActionButton } from '../QueryLibrary/types';
import { selectExploreDSMaps } from '../state/selectors';

import { useQueriesDrawerContext } from './QueriesDrawerContext';
import { i18n } from './utils';

// This makes TS happy as ExploreRunQueryButton has optional onClick prop while QueryActionButton doesn't
// in addition to map the rootDatasourceUid prop.
function ExploreRunQueryButtonWrapper(props: ComponentProps<QueryActionButton>) {
  return <ExploreRunQueryButton {...props} rootDatasourceUid={props.datasourceUid} />;
}

type Props = {
  variant: 'compact' | 'full';
};

/**
 * Dropdown button that can either open a Query History drawer or a Query Library drawer.
 * @param variant
 * @constructor
 */
export function QueriesDrawerDropdown({ variant }: Props) {
  const { drawerOpened, setDrawerOpened } = useQueriesDrawerContext();

  const {
    openDrawer: openQueryLibraryDrawer,
    closeDrawer: closeQueryLibraryDrawer,
    isDrawerOpen: isQueryLibraryDrawerOpen,
    queryLibraryEnabled,
  } = useQueryLibraryContext();

  const [queryOption, setQueryOption] = useState<'library' | 'history'>('library');

  const exploreActiveDS = useSelector(selectExploreDSMaps);

  const styles = useStyles2(getStyles);

  // In case query library is not enabled we show only simple button for query history in the parent.
  if (!queryLibraryEnabled) {
    return undefined;
  }

  function toggleRichHistory() {
    setQueryOption('history');
    setDrawerOpened(!drawerOpened);
  }

  function toggleQueryLibrary() {
    setQueryOption('library');
    if (isQueryLibraryDrawerOpen) {
      closeQueryLibraryDrawer();
    } else {
      // Prefill the query library filter with the dataSource.
      // Get current dataSource that is open. As this is only used in Explore we get it from Explore state.
      const listOfDatasources = createDatasourcesList();
      const activeDatasources = exploreActiveDS.dsToExplore
        .map((eDs) => {
          return listOfDatasources.find((ds) => ds.uid === eDs.datasource?.uid)?.name;
        })
        .filter((name): name is string => !!name);

      openQueryLibraryDrawer(activeDatasources, ExploreRunQueryButtonWrapper);
    }
  }

  const menu = (
    <Menu>
      <Menu.Item label={i18n.queryLibrary} onClick={() => toggleQueryLibrary()} />
      <Menu.Item label={i18n.queryHistory} onClick={() => toggleRichHistory()} />
    </Menu>
  );

  const buttonLabel = queryOption === 'library' ? i18n.queryLibrary : i18n.queryHistory;
  const toggle = queryOption === 'library' ? toggleQueryLibrary : toggleRichHistory;

  return (
    <ButtonGroup>
      <ToolbarButton
        icon="book"
        variant={drawerOpened || isQueryLibraryDrawerOpen ? 'active' : 'canvas'}
        onClick={() => toggle()}
        aria-label={buttonLabel}
      >
        {variant === 'full' ? buttonLabel : undefined}
      </ToolbarButton>

      {/* Show either a drops down button so that user can select QL or QH, or show a close button if one of them is
          already open.*/}
      {drawerOpened || isQueryLibraryDrawerOpen ? (
        <Button className={styles.close} variant="secondary" icon="times" onClick={() => toggle()}></Button>
      ) : (
        <Dropdown overlay={menu}>
          <ToolbarButton
            className={styles.toggle}
            variant="canvas"
            icon="angle-down"
            aria-label={t('explore.rich-history.library-history-dropdown', 'Open query library or query history')}
          />
        </Dropdown>
      )}
    </ButtonGroup>
  );
}

const getStyles = () => ({
  toggle: css({ width: '36px' }),
  // tweaking icon position so it's nicely aligned when dropdown turns into a close button
  close: css({ width: '36px', '> svg': { position: 'relative', left: 2 } }),
});
