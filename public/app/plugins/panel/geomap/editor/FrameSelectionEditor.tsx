import React, { useCallback } from 'react';

import { FrameMatcherID, MatcherConfig, StandardEditorProps } from '@grafana/data';
import { RefIDPicker } from '@grafana/ui/src/components/MatchersUI/FieldsByFrameRefIdMatcher';

type Props = StandardEditorProps<MatcherConfig>;

export const FrameSelectionEditor = ({ value, context, onChange }: Props) => {
  const onFilterChange = useCallback(
    (v: string) => {
      onChange(
        v?.length
          ? {
              id: FrameMatcherID.byRefId,
              options: v,
            }
          : undefined
      );
    },
    [onChange]
  );

  return (
    <RefIDPicker value={value.options} onChange={onFilterChange} data={context.data} placeholder="Change filter" />
  );
};
