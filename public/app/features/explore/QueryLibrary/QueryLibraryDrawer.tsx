import { skipToken } from '@reduxjs/toolkit/query/react';

import { selectors } from '@grafana/e2e-selectors';
import { TabbedContainer, TabConfig } from '@grafana/ui';

import { t } from '../../../core/internationalization';
import { useListQueryTemplateQuery } from '../../query-library';
import { QUERY_LIBRARY_GET_LIMIT } from '../../query-library/api/api';
import { ExploreDrawer } from '../ExploreDrawer';

import { QueryLibrary } from './QueryLibrary';
import { QueryActionButton } from './types';

type Props = {
  isOpen: boolean;
  // List of datasource names to filter query templates by
  activeDatasources: string[] | undefined;
  close: () => void;
  queryActionButton?: QueryActionButton;
};

/**
 * Drawer with query library feature. Handles its own state and should be included in some top level component.
 */
export function QueryLibraryDrawer({ isOpen, activeDatasources, close, queryActionButton }: Props) {
  const { data } = useListQueryTemplateQuery(isOpen ? {} : skipToken);
  const queryTemplatesCount = data?.items?.length ?? 0;

  // TODO: the tabbed container is here mainly for close button and some margins maybe make sense to use something
  //  else as there is only one tab.
  const tabs: TabConfig[] = [
    {
      label: `${t('explore.rich-history.query-library', 'Query library')} (${queryTemplatesCount}/${QUERY_LIBRARY_GET_LIMIT})`,
      value: 'Query library',
      content: <QueryLibrary activeDatasources={activeDatasources} queryActionButton={queryActionButton} />,
      icon: 'book',
    },
  ];

  return (
    isOpen && (
      <ExploreDrawer initialHeight={'75vh'}>
        <TabbedContainer
          tabs={tabs}
          onClose={close}
          defaultTab={'Query library'}
          closeIconTooltip={t('explore.rich-history.close-tooltip', 'Close query history')}
          testId={selectors.pages.Explore.QueryHistory.container}
        />
      </ExploreDrawer>
    )
  );
}
