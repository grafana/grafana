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

import { buildAndUpdateQuery, isOperatorExpression, removeExtraQuotes } from './utils';

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

  if (!builderQuery) {
    return;
  }

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

    const updatedWhereExpressions: BuilderQueryEditorWhereExpression[] = (builderQuery?.where?.expressions || [])
      .filter((condition) => !(isOperatorExpression(condition) && condition.operator?.name === 'has'))
      .map((exp) => exp);

    updatedWhereExpressions.push({
      type: BuilderQueryEditorExpressionType.Operator,
      operator: { name: 'has', value: newSearchTerm },
      property: { name: column || '*', type: BuilderQueryEditorPropertyType.String },
    });

    buildAndUpdateQuery({
      query,
      onQueryUpdate,
      allColumns,
      where: updatedWhereExpressions,
    });
  };

  const onDeleteFuzzySearch = () => {
    setSearchTerm('');
    setSelectedColumn('');
    setIsOpen(false);

    const updatedWhereExpressions: BuilderQueryEditorWhereExpression[] = (builderQuery?.where?.expressions || [])
      .filter(isOperatorExpression)
      .filter((condition) => condition.operator?.name !== 'has');

    buildAndUpdateQuery({
      query,
      onQueryUpdate,
      allColumns,
      where: updatedWhereExpressions,
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label="Fuzzy Search"
          optional={true}
          tooltip={`Find approximate text matches with tolerance for spelling variations. By default, fuzzy search scans all
              columns (*) in the entire table, not just specific fields. This enables locating content across the
              dataset even when exact spelling or column location is unknown.`}
        >
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
