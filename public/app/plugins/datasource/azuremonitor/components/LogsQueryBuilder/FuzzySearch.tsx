import React, { useState } from 'react';

import { EditorRow, EditorFieldGroup, EditorField, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Select } from '@grafana/ui';

import { BuilderQueryEditorExpressionType, BuilderQueryEditorPropertyType } from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { getAggregations, getFilters } from './utils';

interface FuzzySearchProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
}

export const FuzzySearch: React.FC<FuzzySearchProps> = ({ onQueryUpdate, query, allColumns }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  if (!builderQuery) {
    return null;
  }

  const columnOptions = allColumns.map((col) => ({
    label: col.name,
    value: col.name,
  }));

  const handleChange = (newSearchTerm: string, column: string) => {
    setSearchTerm(newSearchTerm);
    setSelectedColumn(column);

    if (query.azureLogAnalytics?.builderQuery) {
      const updatedBuilderQuery = { ...query.azureLogAnalytics.builderQuery };

      if (
        updatedBuilderQuery.where &&
        updatedBuilderQuery.where.expressions &&
        Array.isArray(updatedBuilderQuery.where.expressions)
      ) {
        const existingConditionIndex = updatedBuilderQuery.where.expressions.findIndex(
          (condition) =>
            condition.type === BuilderQueryEditorExpressionType.Operator &&
            'operator' in condition &&
            condition.operator?.name === 'has'
        );

        if (existingConditionIndex !== -1) {
          updatedBuilderQuery.where.expressions.splice(existingConditionIndex, 1);
        }

        updatedBuilderQuery.where.expressions.push({
          type: BuilderQueryEditorExpressionType.Operator,
          operator: { name: 'has', value: newSearchTerm },
          property: { name: column || '*', type: BuilderQueryEditorPropertyType.String },
        });

        const aggregation = getAggregations(updatedBuilderQuery.reduce?.expressions);
        const filters = getFilters(updatedBuilderQuery.where?.expressions);
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
      }
    }
  };

  const onClearFuzzySearch = () => {
    setSearchTerm('');
    setSelectedColumn('');
    setIsOpen(false);
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Fuzzy Search" optional={true}>
          <InputGroup>
            {isOpen ? (
              <>
                <Input
                  className="width-10"
                  type="text"
                  placeholder="Enter search term"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value, selectedColumn)}
                />
                <Select
                  aria-label="Select Column"
                  options={columnOptions}
                  value={selectedColumn}
                  onChange={(e) => handleChange(searchTerm ?? '', e.value ?? '')}
                  width="auto"
                />
                <Button variant="secondary" icon="times" onClick={onClearFuzzySearch} />
              </>
            ) : (
              <></>
            )}
            {!isOpen ? <Button variant="secondary" onClick={() => setIsOpen(true)} icon="plus" /> : <></>}
          </InputGroup>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
