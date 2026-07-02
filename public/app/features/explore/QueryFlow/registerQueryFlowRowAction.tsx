import { CoreApp } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { QueryOperationToggleAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { type QueryActionComponent, RowActionComponents } from 'app/features/query/components/QueryActionComponent';

import { useQueryFlowContext } from './QueryFlowContext';

const ACTION_KEY = 'explore-query-flow';

interface QueryFlowRowActionProps {
  refId: string;
}

function QueryFlowRowAction({ refId }: QueryFlowRowActionProps) {
  const { enabled, isOpen, toggle } = useQueryFlowContext();

  if (!enabled) {
    return null;
  }

  const open = isOpen(refId);

  return (
    <QueryOperationToggleAction
      icon="sitemap"
      title={t('explore.query-flow.row-action', 'Query flow')}
      active={open}
      onClick={() => {
        reportInteraction('grafana_explore_query_flow_toggle', { opened: !open });
        toggle(refId);
      }}
    />
  );
}

const queryFlowRowAction: QueryActionComponent = ({ query, key }) => {
  if (!query?.refId) {
    return null;
  }
  return <QueryFlowRowAction key={key} refId={query.refId} />;
};

let registered = false;

/** Registers the per-query "Query flow" toggle in the Explore query row action bar (idempotent). */
export function registerQueryFlowRowAction() {
  if (registered) {
    return;
  }
  registered = true;
  RowActionComponents.addKeyedExtraRenderAction(ACTION_KEY, {
    scope: CoreApp.Explore,
    queryActionComponent: queryFlowRowAction,
  });
}
