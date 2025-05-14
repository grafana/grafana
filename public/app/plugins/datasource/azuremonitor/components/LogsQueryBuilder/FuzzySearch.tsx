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

import { BuildAndUpdateOptions, removeExtraQuotes } from './utils';

interface FuzzySearchProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const FuzzySearch: React.FC<FuzzySearchProps> = ({
  buildAndUpdateQuery,
  query,
  allColumns,
  templateVariableOptions,
}) => {
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const hasLoadedFuzzySearch = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setSearchTerm('');
      setSelectedColumn('');
      setIsOpen(false);
      hasLoadedFuzzySearch.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedFuzzySearch.current && builderQuery?.fuzzySearch?.expressions?.length) {
      const fuzzy = builderQuery.fuzzySearch.expressions[0];
      setSearchTerm(removeExtraQuotes(String(fuzzy.expressions[0].operator?.value ?? '')));
      setSelectedColumn(fuzzy.expressions[0].property?.name ?? '*');
      setIsOpen(true);
      hasLoadedFuzzySearch.current = true;
    }
  }, [builderQuery]);

  const columnOptions: Array<SelectableValue<string>> = allColumns.map((col) => ({
    label: col.name,
    value: col.name,
  }));

  const safeTemplateVariables: Array<SelectableValue<string>> = Array.isArray(templateVariableOptions)
    ? templateVariableOptions
    : [templateVariableOptions];

  const defaultColumn: SelectableValue<string> = { label: 'All Columns *', value: '*' };
  const selectableOptions = [defaultColumn, ...columnOptions, ...safeTemplateVariables];

  const updateFuzzySearch = (column: string, term: string) => {
    setSearchTerm(term);
    setSelectedColumn(column);

    const fuzzyExpression: BuilderQueryEditorWhereExpression = {
      type: BuilderQueryEditorExpressionType.Operator,
      expressions: [
        {
          type: BuilderQueryEditorExpressionType.Property,
          operator: { name: 'has', value: term },
          property: { name: column || '*', type: BuilderQueryEditorPropertyType.String },
        },
      ],
    };

    buildAndUpdateQuery({
      fuzzySearch: term ? [fuzzyExpression] : [],
    });
  };

  const onDeleteFuzzySearch = () => {
    setSearchTerm('');
    setSelectedColumn('');
    setIsOpen(false);

    buildAndUpdateQuery({
      fuzzySearch: [],
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label="Fuzzy Search"
          optional={true}
          tooltip={`Find approximate text matches with tolerance for spelling variations. By default, fuzzy search scans all
              columns (*) in the entire table, not just specific fields.`}
        >
          <InputGroup>
            {isOpen ? (
              <>
                <Input
                  className="width-10"
                  type="text"
                  placeholder="Enter search term"
                  value={searchTerm}
                  onChange={(e) => updateFuzzySearch(selectedColumn, e.currentTarget.value)}
                />
                <Select
                  aria-label="Select Column"
                  options={selectableOptions}
                  value={{ label: selectedColumn || '*', value: selectedColumn || '*' }}
                  onChange={(e: SelectableValue<string>) => updateFuzzySearch(e.value ?? '*', searchTerm)}
                  width="auto"
                />
                <Button variant="secondary" icon="times" onClick={onDeleteFuzzySearch} />
              </>
            ) : (
              <Button variant="secondary" onClick={() => setIsOpen(true)} icon="plus" />
            )}
          </InputGroup>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
