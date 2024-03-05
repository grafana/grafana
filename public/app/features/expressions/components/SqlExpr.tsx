import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { SQLEditor } from '@grafana/experimental';
import { Switch, Field } from '@grafana/ui';

import { ExpressionQuery } from '../types';

import { NaturalLanguageQuery } from './NaturalLanguageQuery';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const SqlExpr = ({ onChange, refIds, query }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);
  const [useNaturalLanguage, setUseNaturalLanguage] = useState(false);

  const initialQuery = `select * from ${vars[0]} limit 1`;

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  return (
    <div>
      <div className={styles.fieldWrapper}>
        <Field label="Query with Natural Language" description="Use natural language to build your query with AI.">
          <Switch value={useNaturalLanguage} onChange={() => setUseNaturalLanguage(!useNaturalLanguage)} />
        </Field>
      </div>

      {useNaturalLanguage ? (
        <NaturalLanguageQuery query={query} onChange={onChange} />
      ) : (
        <SQLEditor query={query.expression || initialQuery} onChange={onEditorChange}></SQLEditor>
      )}
    </div>
  );
};

const styles = {
  fieldWrapper: css({
    margin: '16px 0',
  }),
};
