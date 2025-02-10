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
    if (selectedColumns.length === 0) {
      setGroupBys([]);
    }
  }, [selectedColumns]);

  const handleGroupByChange = (newItems: Array<Partial<QueryEditorGroupByExpression>>) => {
    console.log("newItems", newItems);

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

  // ✅ Add new GroupBy when "+" is clicked
  const addGroupBy = () => {
    setGroupBys([...groupBys, { type: QueryEditorExpressionType.GroupBy, property: { type: QueryEditorPropertyType.String, name: '' }, interval: undefined, focus: true }]);
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Group by" optional={true}>
          {groupBys.length > 0 ? (
            <EditorList
              items={groupBys}
              onChange={handleGroupByChange}
              renderItem={makeRenderGroupBy(selectedColumns, setGroupBys)}
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
  setGroupBys: React.Dispatch<React.SetStateAction<QueryEditorGroupByExpression[]>>
) => {
  return (
    item: Partial<QueryEditorGroupByExpression>,
    onChange: (updatedItem: QueryEditorGroupByExpression) => void
  ) => (
    <GroupByItem
      groupBy={item}
      onChange={(updatedItem) => {
        setGroupBys((prevGroupBys) =>
          prevGroupBys.map((g) => (g.property.name === item.property?.name ? updatedItem : g))
        );
        onChange(updatedItem);
      }}
      onDelete={() => {
        setGroupBys((prevGroupBys) => prevGroupBys.filter((i) => i.property?.name !== item.property?.name));
      }}
      columns={columns}
    />
  );
};
