import { useEffect, useMemo, useState } from 'react';

import { SelectableValue, StandardEditorProps, TraceSearchProps } from '@grafana/data';

import { SpanFiltersTags } from '../../../features/explore/TraceView/components/TracePageHeader/SpanFilters/SpanFiltersTags';
import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';
import { DEFAULT_TAG_FILTERS } from '../../../features/explore/state/constants';

type Props = StandardEditorProps<TraceSearchProps, unknown, TraceSearchProps>;

export const TagsEditor = ({ value, onChange, context }: Props) => {
  const trace = useMemo(() => transformDataFrames(context.data[0]), [context.data]);
  const [tagKeys, setTagKeys] = useState<Array<SelectableValue<string>>>();
  const [tagValues, setTagValues] = useState<{ [key: string]: Array<SelectableValue<string>> }>({});

  useEffect(() => {
    if (!value.tags) {
      onChange({ ...value, tags: [DEFAULT_TAG_FILTERS] });
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
