import React, { useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { EditorField } from '@grafana/experimental';
import { AutoSizeInput } from '@grafana/ui';

export interface Props {
  legendFormat: string | undefined;
  onChange: (legendFormat: string) => void;
  onRunQuery: () => void;
}

/**
 * Tests for this component are on the parent level (PromQueryBuilderOptions).
 */
export const PromQueryLegendUrlEditor = React.memo<Props>(({ legendFormat, onChange, onRunQuery }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onLegendFormatChanged = (evt: React.FormEvent<HTMLInputElement>) => {
      onRunQuery();
    }
  
  return (
    <EditorField
      label="Legend Url"
      tooltip="Similar to the custom Label this will direct you to the right location"
      data-testid={selectors.components.DataSource.Prometheus.queryEditor.legendUrl}
    >
          <AutoSizeInput
            id="legendFormat"
            minWidth={22}
            placeholder="{{example}}"
            defaultValue={legendFormat}
            onCommitChange={onLegendFormatChanged}
            ref={inputRef}
          />
    </EditorField>
  );
});

PromQueryLegendUrlEditor.displayName = 'PromQueryLegendUrlEditor';

export function getLegendUrlModeLabel(legendUrlFormat: string | undefined) {
  return legendUrlFormat;
}
