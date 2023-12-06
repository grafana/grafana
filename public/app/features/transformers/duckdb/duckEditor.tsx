import React, { useMemo } from 'react';

import { DataTransformerID, TransformerRegistryItem, TransformerUIProps, TransformerCategory } from '@grafana/data';
import { InlineField, RadioButtonGroup } from '@grafana/ui';
import { PRQLEditor } from 'app/features/dashboard/components/TransformationsEditor/PRQLEditor';

import { getTransformationContent } from '../docs/getTransformationContent';

import { DuckDBTransformer, DuckTransformerOptions, QueryType } from './duckTransformer';

const LABEL_WIDTH = 20;

export const DuckTransformerEditor = ({ input, options, onChange }: TransformerUIProps<DuckTransformerOptions>) => {
  const refIDs = useMemo(() => {
    const ids = new Set<string>();
    for (const f of input) {
      if (f.refId) {
        ids.add(f.refId);
      }
    }
    return Array.from(ids);
  }, [input]);

  const queryTypeOptions = [
    { label: 'PRQL', value: QueryType.prql },
    { label: 'SQL', value: QueryType.sql },
  ];

  return (
    <>
      <InlineField labelWidth={LABEL_WIDTH} label="Query syntax">
        <RadioButtonGroup
          options={queryTypeOptions}
          value={options.type}
          onChange={(v) => {
            onChange({ ...options, type: v });
          }}
        />
      </InlineField>
      <PRQLEditor
        metricNames={refIDs}
        queryString={options.query}
        onEditorChange={(v) => {
          onChange({ ...options, query: v });
        }}
      />
    </>
  );
};

export const duckTransformerRegistryItem: TransformerRegistryItem<DuckTransformerOptions> = {
  id: DataTransformerID.duckdb,
  editor: DuckTransformerEditor,
  transformation: DuckDBTransformer,
  name: DuckDBTransformer.name,
  description: DuckDBTransformer.description,
  categories: new Set([TransformerCategory.CalculateNewFields]),
  help: getTransformationContent(DataTransformerID.duckdb).helperDocs,
};
