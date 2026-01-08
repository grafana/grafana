import React, { useEffect, useState, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { EditorField, EditorFieldGroup, EditorList, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorPropertyType,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types/logAnalyticsMetadata';
import { AzureMonitorQuery } from '../../types/query';

import { GroupByItem } from './GroupByItem';
import { BuildAndUpdateOptions } from './utils';

interface GroupBySectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const GroupBySection: React.FC<GroupBySectionProps> = ({
  query,
  buildAndUpdateQuery,
  allColumns,
  templateVariableOptions,
}) => {
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const [groupBys, setGroupBys] = useState<BuilderQueryEditorGroupByExpression[]>(
    builderQuery?.groupBy?.expressions || []
  );

  const hasLoadedGroupBy = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable || builderQuery?.groupBy?.expressions.length === 0) {
      setGroupBys([]);
      hasLoadedGroupBy.current = false;
      prevTable.current = currentTable;
    }
  }, [builderQuery]);

  const availableColumns: Array<SelectableValue<string>> = [];
  const columns = builderQuery?.columns?.columns ?? [];

  if (columns.length > 0) {
    availableColumns.push(
      ...columns.map((col) => ({
        label: col,
        value: col,
      }))
    );
  } else {
    availableColumns.push(
      ...allColumns.map((col) => ({
        label: col.name,
        value: col.name,
      }))
    );
  }

  const handleGroupByChange = (newItems: Array<Partial<BuilderQueryEditorGroupByExpression>>) => {
    setGroupBys(newItems);

    buildAndUpdateQuery({
      groupBy: newItems,
    });
  };

  const onDeleteGroupBy = (propertyName: string) => {
    setGroupBys((prevGroupBys) => {
      const updatedGroupBys = prevGroupBys.filter((gb) => gb.property?.name !== propertyName);

      buildAndUpdateQuery({
        groupBy: updatedGroupBys,
      });

      return updatedGroupBys;
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label={t('components.group-by-section.label-group-by', 'Group by')}
          optional={true}
          tooltip={t(
            'components.group-by-section.tooltip-group-by',
            'Organize results into categories based on specified columns. Group by can be used independently to list unique values in selected columns, or combined with aggregate functions to produce summary statistics for each group. When used alone, it returns distinct combinations of the specified columns.'
          )}
        >
          <InputGroup>
            {groupBys.length > 0 ? (
              <EditorList
                items={groupBys}
                onChange={handleGroupByChange}
                renderItem={makeRenderGroupBy(availableColumns, onDeleteGroupBy, templateVariableOptions)}
              />
            ) : (
              <Button
                aria-label={t('components.group-by-section.aria-label-add-group-by', 'Add group by')}
                variant="secondary"
                icon="plus"
                onClick={() =>
                  handleGroupByChange([
                    {
                      type: BuilderQueryEditorExpressionType.Group_by,
                      property: { type: BuilderQueryEditorPropertyType.String, name: '' },
                    },
                  ])
                }
              />
            )}
          </InputGroup>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const makeRenderGroupBy = (
  columns: Array<SelectableValue<string>>,
  onDeleteGroupBy: (propertyName: string) => void,
  templateVariableOptions: SelectableValue<string>
) => {
  // eslint-disable-next-line react/display-name
  return (
    item: BuilderQueryEditorGroupByExpression,
    onChangeItem: (updatedItem: BuilderQueryEditorGroupByExpression) => void,
    onDeleteItem: () => void
  ) => (
    <GroupByItem
      groupBy={item}
      onChange={(updatedItem) => {
        onChangeItem(updatedItem);
      }}
      onDelete={() => {
        if (item.property?.name) {
          onDeleteGroupBy(item.property.name);
        }
        onDeleteItem();
      }}
      columns={columns}
      templateVariableOptions={templateVariableOptions}
    />
  );
};
