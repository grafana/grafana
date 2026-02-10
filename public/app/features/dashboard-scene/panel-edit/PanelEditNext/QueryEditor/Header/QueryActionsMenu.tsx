import { css } from '@emotion/css';
import { useCallback } from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../../../../inspect/PanelInspectDrawer';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { QueryEditorType } from '../../constants';
import { useActionsContext, usePanelContext, useQueryEditorUIContext } from '../QueryEditorContext';

interface QueryActionsMenuProps {
  app?: CoreApp;
}

/**
 * Actions menu for queries and expressions.
 * Contains duplicate, data source help, and inspector actions.
 */
export function QueryActionsMenu({ app }: QueryActionsMenuProps) {
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

  const styles = useStyles2(getStyles);

  const onOpenInspector = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Query }));
  }, [panel]);

  if (!selectedQuery) {
    return null;
  }

  const isExpression = cardType === QueryEditorType.Expression;
  const hasEditorHelp = !selectedQueryDsLoading && selectedQueryDsData?.datasource?.components?.QueryEditorHelp;

  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            className={styles.menuItem}
            label={t('query-editor.action.duplicate', 'Duplicate query')}
            icon="copy"
            onClick={() => duplicateQuery(selectedQuery.refId)}
          />

          {/* Data source help (queries only, not expressions) */}
          {hasEditorHelp && !isExpression && (
            <Menu.Item
              className={styles.menuItem}
              label={
                showingDatasourceHelp
                  ? t('query-editor.action.hide-help', 'Hide data source help')
                  : t('query-editor.action.show-help', 'Show data source help')
              }
              icon="question-circle"
              onClick={toggleDatasourceHelp}
              active={showingDatasourceHelp}
            />
          )}

          <Menu.Item
            className={styles.menuItem}
            label={t('query-editor.action.inspector', 'Query inspector')}
            icon="brackets-curly"
            onClick={onOpenInspector}
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
        aria-label={t('query-editor.action.more-actions', 'More query actions')}
        tooltip={t('query-editor.action.more-actions', 'More query actions')}
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuItem: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
