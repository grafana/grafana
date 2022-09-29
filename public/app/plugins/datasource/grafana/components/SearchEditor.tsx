import React, { useEffect, useState } from 'react';

import { InlineField, Input, InlineFieldRow, CodeEditor } from '@grafana/ui';
import { SearchQuery } from 'app/features/search/service';

interface Props {
  value: SearchQuery;
  onChange: (value: SearchQuery) => void;
}

export default function SearchEditor({ value, onChange }: Props) {
  const [json, setJSON] = useState('');
  const [query, setQuery] = useState(value.query ?? '');

  useEffect(() => {
    const emptySearchQuery: SearchQuery = {
      query: '*',
      location: '', // general, etc
      ds_uid: '',
      sort: '',
      tags: [],
      kind: [],
      explain: false,
      facet: [{ field: 'kind' }, { field: 'tags' }],
      from: 0,
      limit: 20,
    };

    setJSON(JSON.stringify({ ...emptySearchQuery, ...value }, null, 2));
  }, [value]);

  const handleSearchBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (query !== value.query) {
      onChange({ ...value, query });
    }
  };

  const handleSearchEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }
    handleSearchBlur(e as any);
  };

  const onSaveSearchJSON = (rawSearchJSON: string) => {
    try {
      const searchQuery = JSON.parse(rawSearchJSON) as SearchQuery;
      onChange(searchQuery);
      setQuery(searchQuery.query ?? '');
    } catch (ex) {
      console.log('UNABLE TO parse search', rawSearchJSON, ex);
    }
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" grow={true} labelWidth={12}>
          <Input
            placeholder="Everything"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleSearchEnterKey}
            onBlur={handleSearchBlur}
            spellCheck={false}
          />
        </InlineField>
      </InlineFieldRow>
      <CodeEditor
        height={300}
        language="json"
        value={json}
        onBlur={onSaveSearchJSON}
        onSave={onSaveSearchJSON}
        showMiniMap={false}
        showLineNumbers={true}
      />
    </>
  );
}
