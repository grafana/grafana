import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { type CardActionSource, trackQueryMenuAction } from '../../tracking';
import { useActionsContext, useQueryEditorUIContext, useQueryEditorTypeConfig } from '../QueryEditorContext';

import { type QueryActionTarget } from './headerActionTarget';

interface QueryActionsMenuProps {
  target: QueryActionTarget;
  source?: CardActionSource;
}

export function QueryActionsMenu({ target, source }: QueryActionsMenuProps) {
  const { duplicateQuery } = useActionsContext();
  const { selectedQuery, setSelectedQuery, showingDatasourceHelp, toggleDatasourceHelp } = useQueryEditorUIContext();
  const typeConfig = useQueryEditorTypeConfig();
  const { query, cardType, dsData, dsLoading } = target;

  // Help state is global and only rendered for the selected card.
  const isSelected = selectedQuery?.refId === query.refId;
  const isShowingHelp = isSelected && showingDatasourceHelp;

  const typeLabel = typeConfig[cardType].getLabel();
  const isExpression = cardType === QueryEditorType.Expression;
  const hasEditorHelp = !dsLoading && dsData?.datasource?.components?.QueryEditorHelp;

  return (
    <Dropdown
      overlay={
        <Menu>
          <Menu.Item
            label={t('query-editor-next.action.duplicate', 'Duplicate {{type}}', { type: typeLabel })}
            icon="copy"
            onClick={() => {
              trackQueryMenuAction('duplicate', cardType, source);
              duplicateQuery(query.refId);
            }}
          />

          {hasEditorHelp && !isExpression && (
            <Menu.Item
              label={
                isShowingHelp
                  ? t('query-editor-next.action.hide-help', 'Hide data source help')
                  : t('query-editor-next.action.show-help', 'Show data source help')
              }
              icon="question-circle"
              onClick={() => {
                trackQueryMenuAction('toggle_datasource_help', cardType, source);
                // Selecting resets the help toggle, so a non-selected card always opens its help.
                if (!isSelected) {
                  setSelectedQuery(query);
                }
                toggleDatasourceHelp();
              }}
              active={isShowingHelp}
            />
          )}
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
