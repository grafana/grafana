import React, { useState, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { AzureMonitorQuery } from '../../types';

import { GroupByItem } from './GroupByItem';
import { QueryEditorExpressionType, QueryEditorGroupByExpression, QueryEditorPropertyType } from './utils';

interface GroupBySectionProps {
  query: AzureMonitorQuery;
  selectedColumns: Array<SelectableValue<string>>;
  onChange: (query: AzureMonitorQuery) => void;
}

export const GroupBySection: React.FC<GroupBySectionProps> = ({ query, selectedColumns, onChange: onQueryChange }) => {
  const existingGroupBys = extractGroupByFromQuery(query);
  const [groupBys, setGroupBys] = useState<QueryEditorGroupByExpression[]>(existingGroupBys);

  const handleGroupByChange = (newItems: Array<Partial<QueryEditorGroupByExpression>>) => {
    let cleaned: QueryEditorGroupByExpression[] = newItems
      .filter((v) => v.property?.name)
      .map((v, index) => ({
        type: QueryEditorExpressionType.GroupBy,
        property: v.property ?? { type: QueryEditorPropertyType.String, name: '' },
        interval: v.interval,
        focus: index === newItems.length - 1, 
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
  
    if (query.azureLogAnalytics?.query) {
      const newQueryString = applyGroupByToQuery(query.azureLogAnalytics.query, cleaned);
      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          query: newQueryString,
        },
      });
    }
  };  

  return (
    <>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Group by" optional={true}>
            <EditorList
              items={groupBys}
              onChange={handleGroupByChange}
              renderItem={makeRenderGroupBy(selectedColumns, handleGroupByChange, groupBys, setGroupBys)}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </>
  );
};

const makeRenderGroupBy = (
  columns: Array<SelectableValue<string>>,
  onParentChange: (items: Array<Partial<QueryEditorGroupByExpression>>) => void,
  groupBys: QueryEditorGroupByExpression[],
  setGroupBys: React.Dispatch<React.SetStateAction<QueryEditorGroupByExpression[]>>
) => {
  return (
    item: Partial<QueryEditorGroupByExpression>,
    onChange: (updatedItem: QueryEditorGroupByExpression) => void,
    onDelete: () => void
  ) => {
    return (
      <GroupByItem
        groupBy={item}
        onChange={(updatedItem) => {
          onChange(updatedItem);
          setGroupBys((prevGroupBys) => {
            const updatedGroupBys = prevGroupBys.map((g) =>
              g.property.name === item.property?.name ? updatedItem : g
            );

            return updatedGroupBys.length > 0 ? updatedGroupBys : [{ 
              type: QueryEditorExpressionType.GroupBy, 
              property: { type: QueryEditorPropertyType.String, name: '' },
              interval: undefined,
              focus: true,
            }];
          });
        }}
        onDelete={() => {
          setGroupBys((prevGroupBys) => {
            let updatedGroupBys = prevGroupBys.filter((i) => i.property?.name !== item.property?.name);
            if (updatedGroupBys.length === 0) {
              updatedGroupBys.push({
                type: QueryEditorExpressionType.GroupBy,
                property: { type: QueryEditorPropertyType.String, name: '' },
                interval: undefined,
                focus: true,
              });
            }

            return updatedGroupBys;
          });
        }}
        columns={columns}
      />
    );
  };
};

const extractGroupByFromQuery = (query: AzureMonitorQuery): QueryEditorGroupByExpression[] => {
  const match = query.query?.match(/summarize.*?by\s+([\w\s,]+)/i);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((col) => col.trim())
    .filter((col) => col)
    .map(
      (col): QueryEditorGroupByExpression => ({
        type: QueryEditorExpressionType.GroupBy,
        property: { name: col, type: QueryEditorPropertyType.String },
        interval: undefined,
      })
    );
};

const applyGroupByToQuery = (query: string, groupBys: QueryEditorGroupByExpression[]): string => {
  if (!groupBys.length) {
    return query.replace(/\| summarize.*by.*/gi, "").trim();
  }

  const groupByFields = groupBys
    .map((gb) =>
      gb.property?.type === QueryEditorPropertyType.DateTime
        ? `bin_at(${gb.property.name}, $__timeFrom, 1m)`
        : gb.property.name
    )
    .join(', ');

  let newQuery = query.replace(/\| summarize.*by.*/gi, "").trim();
  newQuery += ` | summarize count() by ${groupByFields}`;

  return newQuery;
};

