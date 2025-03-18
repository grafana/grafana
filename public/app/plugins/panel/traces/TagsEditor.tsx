import { useEffect, useMemo, useState } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';

import { SpanFiltersTags } from '../../../features/explore/TraceView/components/TracePageHeader/SpanFilters/SpanFiltersTags';
import { defaultTagFilter, SearchProps } from '../../../features/explore/TraceView/useSearch';
import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

type Props = StandardEditorProps<SearchProps, unknown, SearchProps>;

export const TagsEditor = ({ value, onChange, context }: Props) => {
  const trace = useMemo(() => transformDataFrames(context.data[0]), [context.data]);
  const [tagKeys, setTagKeys] = useState<Array<SelectableValue<string>>>();
  const [tagValues, setTagValues] = useState<{ [key: string]: Array<SelectableValue<string>> }>({});

  useEffect(() => {
    if (!value.tags) {
      onChange({ ...value, tags: [defaultTagFilter] });
    }
  }, [onChange, value]);

  if (!trace) {
    return null;
  }

  return (
    <SpanFiltersTags
      search={value}
      setSearch={onChange}
      trace={trace}
      tagKeys={tagKeys}
      setTagKeys={setTagKeys}
      tagValues={tagValues}
      setTagValues={setTagValues}
    />
  );
};
