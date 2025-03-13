import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';
import { Button } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorPropertyType,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { GroupByItem } from './GroupByItem';
import { getAggregations, getFilters } from './utils';

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
  const [groupBys, setGroupBys] = useState<BuilderQueryEditorGroupByExpression[]>([]);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  if (!builderQuery) {
    return;
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
    let cleaned: BuilderQueryEditorGroupByExpression[] = newItems
      .filter((g) => g.property?.name)
      .map((g) => ({
        type: BuilderQueryEditorExpressionType.Group_by,
        property: g.property ?? { type: BuilderQueryEditorPropertyType.String, name: '' },
        interval: g.interval,
        focus: g.focus ?? false,
      }));

    setGroupBys(cleaned);
    let groupByClauses: string[] = [];

    cleaned.forEach((gb) => {
      if (gb.property?.name) {
        const isDatetime = allColumns.find((col) => col.name === gb.property?.name)?.type === 'datetime';

        if (isDatetime) {
          groupByClauses.push(`bin(${gb.property.name}, 1m)`);
        } else {
          groupByClauses.push(gb.property.name);
        }
      }
    });

    const updatedBuilderQuery = {
      ...builderQuery,
      groupBy: {
        expressions: cleaned,
        type: BuilderQueryEditorExpressionType.Group_by,
      },
    };

    const aggregation = getAggregations(builderQuery.reduce?.expressions);
    const filters = getFilters(builderQuery.where?.expressions);
    const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
      updatedBuilderQuery,
      allColumns,
      aggregation,
      filters
    );

    onQueryUpdate({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        builderQuery: updatedBuilderQuery,
        query: updatedQueryString,
      },
    });
  };

  const onDeleteGroupBy = (propertyName: string) => {
    setGroupBys((prevGroupBys) => {
      const updatedGroupBys = prevGroupBys.filter((gb) => gb.property.name !== propertyName);
      const hasSelectedDatetime = updatedGroupBys.some(
        (g) => g.property?.type === BuilderQueryEditorPropertyType.Datetime
      );
      const shouldIncludeTime = !updatedGroupBys.length || hasSelectedDatetime;

      let groupByClauses = updatedGroupBys.map((gb) => gb.property.name);

      if (updatedGroupBys.length === 0) {
        groupByClauses = [];
      } else {
        if (!shouldIncludeTime) {
          groupByClauses = groupByClauses.filter((g) => g !== `bin(TimeGenerated, 1m)`);
        }
      }

      const updatedBuilderQuery: BuilderQueryExpression = {
        ...builderQuery,
        groupBy: {
          expressions: updatedGroupBys,
          type: BuilderQueryEditorExpressionType.Group_by,
        },
      };

      const aggregation = getAggregations(builderQuery.reduce?.expressions);
      const filters = getFilters(builderQuery.where?.expressions);
      const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
        updatedBuilderQuery,
        allColumns,
        aggregation,
        filters
      );

      onQueryUpdate({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          builderQuery: updatedBuilderQuery,
          query: updatedQueryString,
        },
      });

      return updatedGroupBys;
    });
  };

  const addGroupBy = () => {
    setGroupBys([
      ...groupBys,
      {
        type: BuilderQueryEditorExpressionType.Group_by,
        property: { type: BuilderQueryEditorPropertyType.String, name: '' },
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
              renderItem={makeRenderGroupBy(availableColumns, onDeleteGroupBy, templateVariableOptions)}
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
