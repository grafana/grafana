import React, { useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { EditorField } from '@grafana/experimental';
import { AutoSizeInput } from '@grafana/ui';

export interface Props {
  legendUrlFormat: string | undefined;
  onChange: (legendUrlFormat: string) => void;
  onRunQuery: () => void;
}

/**
 * Tests for this component are on the parent level (PromQueryBuilderOptions).
 */
export const PromQueryLegendUrlEditor = React.memo<Props>(({ legendUrlFormat, onChange, onRunQuery }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onLegendUrlFormatChanged = (evt: React.FormEvent<HTMLInputElement>) => {
      onChange(evt.currentTarget.value);
      onRunQuery();
    }
  
  return (
    <EditorField
      label="Legend Url"
      tooltip="Similar to the custom Label this will direct you to the right location"
      data-testid={selectors.components.DataSource.Prometheus.queryEditor.legendUrl}
    >
          <AutoSizeInput
            id="legendUrlFormat"
            minWidth={22}
            placeholder="{{example}}"
            defaultValue={legendUrlFormat}
            onCommitChange={onLegendUrlFormatChanged}
            ref={inputRef}
          />
    </EditorField>
  );
});

PromQueryLegendUrlEditor.displayName = 'PromQueryLegendUrlEditor';

export function getLegendUrlModeLabel(legendUrlFormat: string | undefined) {
  return legendUrlFormat;
}
