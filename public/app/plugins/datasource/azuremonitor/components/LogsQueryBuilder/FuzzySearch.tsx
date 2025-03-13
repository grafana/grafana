import React, { useState, useEffect, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow, EditorFieldGroup, EditorField, InputGroup } from '@grafana/plugin-ui';
import { Button, Input, Select } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorWhereExpression,
  BuilderQueryEditorPropertyType,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { getAggregations, getFilters, isOperatorExpression, removeExtraQuotes } from './utils';

interface FuzzySearchProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const FuzzySearch: React.FC<FuzzySearchProps> = ({
  onQueryUpdate,
  query,
  allColumns,
  templateVariableOptions,
}) => {
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);

  if (!builderQuery) {
    return;
  }

  const hasLoadedFuzzySearch = useRef(false);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setSearchTerm('');
      setSelectedColumn('');
      setIsOpen(false);
      hasLoadedFuzzySearch.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedFuzzySearch.current && builderQuery?.where?.expressions) {
      const fuzzyCondition = builderQuery.where.expressions.find(
        (condition) => isOperatorExpression(condition) && condition.operator?.name === 'has'
      );

      if (fuzzyCondition && isOperatorExpression(fuzzyCondition)) {
        setSearchTerm(removeExtraQuotes(String(fuzzyCondition.operator?.value ?? '')));
        setSelectedColumn(fuzzyCondition.property?.name ?? '');
        setIsOpen(true);
      }
    }
  }, [builderQuery]);

  const columnOptions: Array<SelectableValue<string>> = allColumns.map((col) => ({
    label: col.name,
    value: col.name,
  }));

  const safeTemplateVariables: Array<SelectableValue<string>> = templateVariableOptions
    ? Array.isArray(templateVariableOptions)
      ? templateVariableOptions
      : [templateVariableOptions]
    : [];

  const defaultColumn: SelectableValue<string> = { label: 'All Columns *', value: '*' };
  const selectableOptions = [defaultColumn, ...columnOptions, ...safeTemplateVariables];

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
        const isOperatorExpression = (exp: BuilderQueryEditorWhereExpression) => {
          return exp?.type === BuilderQueryEditorExpressionType.Operator && 'operator' in exp && 'property' in exp;
        };

        updatedBuilderQuery.where.expressions = updatedBuilderQuery.where.expressions.filter(
          (condition) => !(isOperatorExpression(condition) && condition.operator?.name === 'has')
        );

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

  const onDeleteFuzzySearch = () => {
    setSearchTerm('');
    setSelectedColumn('');
    setIsOpen(false);

    if (builderQuery.where?.expressions) {
      const updatedBuilderQuery = { ...builderQuery };

      if (!updatedBuilderQuery.where) {
        updatedBuilderQuery.where = { expressions: [], type: BuilderQueryEditorExpressionType.And };
      }

      let updatedWhereExpressions: BuilderQueryEditorWhereExpression[] = updatedBuilderQuery.where.expressions
        .filter(isOperatorExpression)
        .filter((condition) => condition.operator?.name !== 'has');

      updatedBuilderQuery.where =
        updatedWhereExpressions.length > 0
          ? { expressions: updatedWhereExpressions, type: BuilderQueryEditorExpressionType.And }
          : undefined;

      const aggregation = getAggregations(updatedBuilderQuery.reduce?.expressions);
      const filters = getFilters(updatedWhereExpressions);
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
                  options={selectableOptions}
                  value={selectedColumn === '' ? defaultColumn : selectedColumn}
                  onChange={(e) => handleChange(searchTerm ?? '', e.value ?? '')}
                  width="auto"
                />
                <Button variant="secondary" icon="times" onClick={onDeleteFuzzySearch} />
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
