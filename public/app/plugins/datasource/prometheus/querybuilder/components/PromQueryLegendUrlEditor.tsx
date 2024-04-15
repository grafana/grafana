import React, { useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { EditorField } from '@grafana/experimental';
import { AutoSizeInput } from '@grafana/ui';

export interface Props {
  legendUrl: string | undefined;
  onChange: (legendUrl: string) => void;
  onRunQuery: () => void;
}

export const PromQueryLegendUrlEditor = React.memo<Props>(({ legendUrl, onChange, onRunQuery }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onLegendUrlChanged = (evt: React.FormEvent<HTMLInputElement>) => {
      onChange(evt.currentTarget.value);
      onRunQuery();
    }
  
  return (
    <EditorField
      label="Legend Url"
      tooltip="If the url is set, the label in the legend will become clickable, you can use variables similar to Legend Label."
      data-testid={selectors.components.DataSource.Prometheus.queryEditor.legendUrl}
    >
          <AutoSizeInput
            id="legendUrl"
            minWidth={22}
            placeholder="/your/{{example}}/url"
            defaultValue={legendUrl}
            onCommitChange={onLegendUrlChanged}
            ref={inputRef}
          />
    </EditorField>
  );
});

PromQueryLegendUrlEditor.displayName = 'PromQueryLegendUrlEditor';