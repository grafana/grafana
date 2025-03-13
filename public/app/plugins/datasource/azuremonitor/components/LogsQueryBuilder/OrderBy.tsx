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

interface OrderByProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const OrderBy: React.FC<OrderByProps> = ({
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

  const hasLoadedOrderBy = useRef(false);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setSearchTerm('');
      setSelectedColumn('');
      setIsOpen(false);
      hasLoadedOrderBy.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedOrderBy.current && builderQuery?.where?.expressions) {
    //   const fuzzyCondition = builderQuery.where.expressions.find(
    //     (condition) => isOperatorExpression(condition) && condition.operator?.name === 'has'
    //   );

    //   if (fuzzyCondition && isOperatorExpression(fuzzyCondition)) {
    //     setSearchTerm(removeExtraQuotes(String(fuzzyCondition.operator?.value ?? '')));
    //     setSelectedColumn(fuzzyCondition.property?.name ?? '');
    //     setIsOpen(true);
    //   }
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

  };

  const onDeleteOrderBy = () => {
  
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Order by" optional={true}>
          <InputGroup>
            {isOpen ? (
              <>
                <Select
                  aria-label="Select Column"
                  options={selectableOptions}
                  value={selectedColumn === '' ? defaultColumn : selectedColumn}
                  onChange={(e) => handleChange(searchTerm ?? '', e.value ?? '')}
                  width="auto"
                />
                <Select
                  aria-label="Select Order"
                  options={selectableOptions}
                  value={selectedColumn === '' ? defaultColumn : selectedColumn}
                  onChange={(e) => handleChange(searchTerm ?? '', e.value ?? '')}
                  width="auto"
                />
                <Button variant="secondary" icon="times" onClick={onDeleteOrderBy} />
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
