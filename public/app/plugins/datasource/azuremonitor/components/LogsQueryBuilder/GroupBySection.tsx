import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';
import { Button } from '@grafana/ui';

import { AzureLogAnalyticsMetadataColumn, QueryEditorPropertyType } from '../../types';

import { GroupByItem } from './GroupByItem';
import { QueryEditorExpressionType, QueryEditorGroupByExpression } from './expressions';

interface GroupBySectionProps {
  selectedColumns: Array<SelectableValue<string>>;
  columns: AzureLogAnalyticsMetadataColumn[];
  selectedTable: string;
  onQueryUpdate: (params: { groupBy?: string[] }) => void;
}

export const GroupBySection: React.FC<GroupBySectionProps> = ({
  selectedColumns,
  selectedTable,
  onQueryUpdate,
  columns,
}) => {
  const [groupBys, setGroupBys] = useState<QueryEditorGroupByExpression[]>([]);

  const availableColumns =
    selectedColumns.length > 0
      ? selectedColumns
      : columns.map((col) => ({
          label: col.name,
          value: col.name,
        }));

  useEffect(() => {
    setGroupBys(() => {
      return [];
    });
  }, [selectedTable]);

  const handleGroupByChange = (newItems: Array<Partial<QueryEditorGroupByExpression>>) => {
    let cleaned: QueryEditorGroupByExpression[] = newItems
      .filter((g) => g.property?.name)
      .map((g) => ({
        type: QueryEditorExpressionType.GroupBy,
        property: g.property ?? { type: QueryEditorPropertyType.String, name: '' },
        interval: g.interval,
        focus: g.focus ?? false,
      }));

    setGroupBys(cleaned);

    let groupByClauses: string[] = [];

    cleaned.forEach((gb) => {
      if (gb.property?.name) {
        const isDatetime = columns.find((col) => col.name === gb.property?.name)?.type === 'datetime';

        // 🔥 **Replace raw datetime with bin() if it's in groupBy**
        if (isDatetime) {
          groupByClauses.push(`bin(${gb.property.name}, 1m)`);
        } else {
          groupByClauses.push(gb.property.name);
        }
      }
    });

    onQueryUpdate({ groupBy: groupByClauses });
  };

  const onDeleteGroupBy = (propertyName: string) => {
    setGroupBys((prevGroupBys) => {
      const updatedGroupBys = prevGroupBys.filter((gb) => gb.property.name !== propertyName);

      let hasSelectedDatetime = updatedGroupBys.some((g) => g.property?.type === QueryEditorPropertyType.DateTime);
      let shouldIncludeTime = selectedColumns.length === 0 || hasSelectedDatetime;

      let groupByClauses = updatedGroupBys.map((gb) => gb.property.name);

      if (updatedGroupBys.length === 0) {
        groupByClauses = [];
      } else {
        if (!shouldIncludeTime) {
          groupByClauses = groupByClauses.filter((g) => g !== `bin(TimeGenerated, 1m)`);
        }
      }

      console.log(
        'groupByClauses.length > 0 ? groupByClauses : undefined',
        groupByClauses.length > 0 ? groupByClauses : undefined
      );

      onQueryUpdate({
        groupBy: groupByClauses.length > 0 ? groupByClauses : undefined,
      });

      console.log('updatedGroupBys', updatedGroupBys);
      return updatedGroupBys;
    });
  };

  const addGroupBy = () => {
    setGroupBys([
      ...groupBys,
      {
        type: QueryEditorExpressionType.GroupBy,
        property: { type: QueryEditorPropertyType.String, name: '' },
        interval: undefined,
        focus: true,
      },
    ]);
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Group by" optional={true}>
          {groupBys.length > 0 ? (
            <EditorList
              items={groupBys}
              onChange={handleGroupByChange}
              renderItem={makeRenderGroupBy(availableColumns, onDeleteGroupBy)}
            />
          ) : (
            <Button variant="secondary" icon="plus" onClick={addGroupBy} />
          )}
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const makeRenderGroupBy = (
  columns: Array<SelectableValue<string>>,
  onDeleteGroupBy: (propertyName: string) => void
) => {
  return (
    item: Partial<QueryEditorGroupByExpression>,
    onChangeItem: (updatedItem: Partial<QueryEditorGroupByExpression>) => void,
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
    />
  );
};
