import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';
import { Button } from '@grafana/ui';

import { QueryEditorPropertyType } from '../../types';

import { GroupByItem } from './GroupByItem';
import { QueryEditorExpressionType, QueryEditorGroupByExpression } from './expressions';

interface GroupBySectionProps {
  selectedColumns: Array<SelectableValue<string>>;
  onQueryUpdate: (params: { groupBy?: string[] }) => void;
}

export const GroupBySection: React.FC<GroupBySectionProps> = ({ selectedColumns, onQueryUpdate }) => {
  const [groupBys, setGroupBys] = useState<QueryEditorGroupByExpression[]>([]);

  useEffect(() => {
    setGroupBys((prevGroupBys) =>
      prevGroupBys.filter((g) => selectedColumns.some((col) => col.value === g.property.name))
    );
  }, [selectedColumns]);

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
    onQueryUpdate({ groupBy: cleaned.map((gb) => gb.property?.name ?? '') });
  };

  const onDeleteGroupBy = (propertyName: string) => {
    setGroupBys((prevGroupBys) => {
      const updatedGroupBys = prevGroupBys.filter((gb) => gb.property.name !== propertyName);

      // Ensure the query updates correctly
      onQueryUpdate({
        groupBy: updatedGroupBys.length > 0 ? updatedGroupBys.map((gb) => gb.property.name) : undefined,
      });

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
              renderItem={makeRenderGroupBy(selectedColumns, onDeleteGroupBy)}
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
