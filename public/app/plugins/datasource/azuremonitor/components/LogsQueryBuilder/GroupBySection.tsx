import React, { useEffect, useState, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Icon, Tooltip } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorPropertyType,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { GroupByItem } from './GroupByItem';
import { buildAndUpdateQuery } from './utils';

interface GroupBySectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const GroupBySection: React.FC<GroupBySectionProps> = ({
  query,
  onQueryUpdate,
  allColumns,
  templateVariableOptions,
}) => {
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const [groupBys, setGroupBys] = useState<BuilderQueryEditorGroupByExpression[]>(() => {
    return builderQuery?.groupBy?.expressions || [];
  });

  const hasLoadedGroupBy = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setGroupBys([]);
      hasLoadedGroupBy.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedGroupBy.current && builderQuery?.groupBy?.expressions && groupBys.length === 0) {
      setGroupBys(builderQuery.groupBy.expressions);
      hasLoadedGroupBy.current = true;
    }
  }, [builderQuery, groupBys]);

  if (!builderQuery) {
    return <></>;
  }

  const availableColumns: Array<SelectableValue<string>> = [];
  const columns = builderQuery.columns?.columns ?? [];

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
    const cleaned: BuilderQueryEditorGroupByExpression[] = newItems.map((g) => ({
      type: BuilderQueryEditorExpressionType.Group_by,
      property: g.property ?? { type: BuilderQueryEditorPropertyType.String, name: '' },
      interval: g.interval,
      focus: g.focus ?? false,
    }));
  
    setGroupBys(cleaned);
  
    if (cleaned[0]?.property.name === '') {
      return;
    }
  
    buildAndUpdateQuery({
      query,
      onQueryUpdate,
      allColumns,
      groupBy: cleaned,
    });
  };  

  const onDeleteGroupBy = (propertyName: string) => {
    setGroupBys((prevGroupBys) => {
      const updatedGroupBys = prevGroupBys.filter((gb) => gb.property.name !== propertyName);
  
      buildAndUpdateQuery({
        query,
        onQueryUpdate,
        allColumns,
        groupBy: updatedGroupBys,
      });
  
      return updatedGroupBys;
    });
  };  

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Group by" optional={true}>
          <InputGroup>
            {groupBys.length > 0 ? (
              <EditorList
                items={groupBys}
                onChange={handleGroupByChange}
                renderItem={makeRenderGroupBy(availableColumns, onDeleteGroupBy, templateVariableOptions)}
              />
            ) : (
              <Button
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
        <Tooltip
          content={
            <>
              Organize results into categories based on specified columns. Group by can be used independently to list
              unique values in selected columns, or combined with aggregate functions to produce summary statistics for
              each group. When used alone, it returns distinct combinations of the specified columns.{' '}
            </>
          }
          placement="right"
          interactive={true}
        >
          <Icon name="info-circle" />
        </Tooltip>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const makeRenderGroupBy = (
  columns: Array<SelectableValue<string>>,
  onDeleteGroupBy: (propertyName: string) => void,
  templateVariableOptions: SelectableValue<string>
) => {
  return (
    item: Partial<BuilderQueryEditorGroupByExpression>,
    onChangeItem: (updatedItem: Partial<BuilderQueryEditorGroupByExpression>) => void,
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
