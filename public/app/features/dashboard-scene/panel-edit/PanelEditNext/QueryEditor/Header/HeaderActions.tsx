import { RefObject } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';
import { QueryActionAssistantButton } from 'app/features/query/components/QueryActionAssistantButton';

import { QueryEditorType } from '../../constants';
import { useDatasourceContext } from '../QueryEditorContext';

import { ActionsMenu } from './ActionsMenu';
import { InspectorButton } from './InspectorButton';
import { SaveButton } from './SaveButton';
import { WarningBadges } from './WarningBadges';

interface HeaderActionsProps {
  cardType: QueryEditorType;
  containerRef?: RefObject<HTMLDivElement>;
  queries: DataQuery[];
  query: DataQuery;
}

/**
 * Container for all action buttons in the query editor header.
 *
 * @remarks
 * Each child component is responsible for determining its own visibility
 * based on the cardType prop. This keeps the logic decentralized and
 * each component self-contained.
 */
export function HeaderActions({ cardType, containerRef, queries, query }: HeaderActionsProps) {
  const { datasource, dsSettings } = useDatasourceContext();

  return (
    <Stack gap={1} alignItems="center">
      {/* Custom behavior for recently implemented query assistant button */}
      {cardType === QueryEditorType.Query && dsSettings && (
        <QueryActionAssistantButton
          app={CoreApp.PanelEditor}
          datasourceApi={datasource ?? null}
          dataSourceInstanceSettings={dsSettings}
          queries={queries}
          query={query}
        />
      )}
      <WarningBadges cardType={cardType} />
      <SaveButton cardType={cardType} parentRef={containerRef} />
      <InspectorButton />
      <ActionsMenu cardType={cardType} />
    </Stack>
  );
}
