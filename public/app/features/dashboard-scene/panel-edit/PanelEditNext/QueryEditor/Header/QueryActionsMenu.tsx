import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../../../../inspect/PanelInspectDrawer';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { QueryEditorType } from '../../constants';
import { trackQueryMenuAction } from '../../tracking';
import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryEditorTypeConfig,
} from '../QueryEditorContext';

export function QueryActionsMenu() {
  const { duplicateQuery } = useActionsContext();
  const { panel } = usePanelContext();
  const {
    selectedQuery,
    selectedQueryDsData,
    selectedQueryDsLoading,
    showingDatasourceHelp,
    toggleDatasourceHelp,
    cardType,
  } = useQueryEditorUIContext();
  const typeConfig = useQueryEditorTypeConfig();

  const onOpenInspector = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Query }));
  }, [panel]);

  if (!selectedQuery) {
    return null;
  }

  const typeLabel = typeConfig[cardType].getLabel();
  const isExpression = cardType === QueryEditorType.Expression;
  const hasEditorHelp = !selectedQueryDsLoading && selectedQueryDsData?.datasource?.components?.QueryEditorHelp;

  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            label={t('query-editor-next.action.duplicate', 'Duplicate {{type}}', { type: typeLabel })}
            icon="copy"
            onClick={() => {
              trackQueryMenuAction('duplicate', cardType);
              duplicateQuery(selectedQuery.refId);
            }}
          />

          {/* Data source help (queries only, not expressions) */}
          {hasEditorHelp && !isExpression && (
            <Menu.Item
              label={
                showingDatasourceHelp
                  ? t('query-editor-next.action.hide-help', 'Hide data source help')
                  : t('query-editor-next.action.show-help', 'Show data source help')
              }
              icon="question-circle"
              onClick={() => {
                trackQueryMenuAction('toggle_datasource_help', cardType);
                toggleDatasourceHelp();
              }}
              active={showingDatasourceHelp}
            />
          )}

          <Menu.Item
            label={t('query-editor-next.action.inspector', 'Query inspector')}
            icon="brackets-curly"
            onClick={() => {
              trackQueryMenuAction('open_inspector', cardType);
              onOpenInspector();
            }}
          />
        </Menu>
      }
      placement="bottom-end"
    >
      <Button
        size="sm"
        fill="text"
        icon="ellipsis-v"
        variant="secondary"
        aria-label={t('query-editor-next.action.more-actions', 'More {{type}} actions', { type: typeLabel })}
        tooltip={t('query-editor-next.action.more-actions', 'More {{type}} actions', { type: typeLabel })}
      />
    </Dropdown>
  );
}
