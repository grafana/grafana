import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { QueryEditorPropertyType } from '../../types';

import { GroupByItem } from './GroupByItem';
import { QueryEditorExpressionType, QueryEditorGroupByExpression } from './expressions';

interface GroupBySectionProps {
  selectedColumns: Array<SelectableValue<string>>;
  onQueryUpdate: (params: { groupBy?: string[] }) => void;
}

export const GroupBySection: React.FC<GroupBySectionProps> = ({ selectedColumns, onQueryUpdate }) => {
  const [groupBys, setGroupBys] = useState<QueryEditorGroupByExpression[]>([]);

  const handleGroupByChange = (newItems: Array<Partial<QueryEditorGroupByExpression>>) => {
    let cleaned: QueryEditorGroupByExpression[] = newItems
      .filter((g) => g.property?.name)
      .map((g) => ({
        type: QueryEditorExpressionType.GroupBy,
        property: g.property ?? { type: QueryEditorPropertyType.String, name: '' },
        interval: g.interval,
        focus: g.focus ?? false,
      }));

    if (cleaned.length === 0) {
      cleaned = [
        {
          type: QueryEditorExpressionType.GroupBy,
          property: { type: QueryEditorPropertyType.String, name: '' },
          interval: undefined,
          focus: true,
        },
      ];
    }

    setGroupBys(cleaned);
    onQueryUpdate({ groupBy: cleaned.map((gb) => gb.property?.name ?? '') });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Group by" optional={true}>
          <EditorList
            items={groupBys}
            onChange={handleGroupByChange}
            renderItem={makeRenderGroupBy(selectedColumns, setGroupBys)}
          />
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
    onChange: (updatedItem: QueryEditorGroupByExpression) => void,
    onDelete: () => void
  ) => (
    <GroupByItem
      groupBy={item}
      onChange={(updatedItem) => {
        setGroupBys((prevGroupBys) =>
          prevGroupBys.map((g) => (g.property.name === item.property?.name ? updatedItem : g))
        );
      }}
      onDelete={() => {
        setGroupBys((prevGroupBys) => prevGroupBys.filter((i) => i.property?.name !== item.property?.name));
      }}
      columns={columns}
    />
  );
};
