import * as React from 'react';

import { ConfigDescriptionLink, ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Badge, InlineField, InlineFieldRow, Input } from '@grafana/ui';

type Props = {
  maxLines: string;
  onMaxLinedChange: (value: string) => void;
  predefinedOperations: string;
  onPredefinedOperationsChange: (value: string) => void;
};

export const QuerySettings = (props: Props) => {
  const { maxLines, onMaxLinedChange, predefinedOperations, onPredefinedOperationsChange } = props;
  return (
    <ConfigSubSection
      title="Queries"
      description={
        <ConfigDescriptionLink
          description="Additional options to customize your querying experience."
          suffix="loki/configure-loki-data-source/#queries"
          feature="query settings"
        />
      }
    >
      <InlineField
        label="Maximum lines"
        htmlFor="loki_config_maxLines"
        labelWidth={22}
        tooltip={
          <>
            Loki queries must contain a limit of the maximum number of lines returned (default: 1000). Increase this
            limit to have a bigger result set for ad-hoc analysis. Decrease this limit if your browser becomes sluggish
            when displaying the log results.
          </>
        }
      >
        <Input
          type="number"
          id="loki_config_maxLines"
          value={maxLines}
          onChange={(event: React.FormEvent<HTMLInputElement>) => onMaxLinedChange(event.currentTarget.value)}
          width={16}
          placeholder="1000"
          spellCheck={false}
        />
      </InlineField>

      {config.featureToggles.lokiPredefinedOperations && (
        <InlineFieldRow>
          <InlineField
            label="Predefined operations"
            htmlFor="loki_config_predefinedOperations"
            labelWidth={22}
            tooltip={
              <>
                {
                  'Predefined operations are used as an initial state for your queries. They are useful, if you want to unpack, parse or format all log lines. Currently we support only log operations starting with |. For example: | unpack | line_format "{{.message}}".'
                }
              </>
            }
          >
            <Input
              type="string"
              id="loki_config_predefinedOperations"
              value={predefinedOperations}
              onChange={(event: React.FormEvent<HTMLInputElement>) =>
                onPredefinedOperationsChange(event.currentTarget.value)
              }
              width={40}
              placeholder="| unpack | line_format"
              spellCheck={false}
            />
          </InlineField>
          <InlineField>
            <Badge
              text="Experimental"
              color="orange"
              icon="exclamation-triangle"
              tooltip="Predefined operations is an experimental feature that may change in the future."
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </ConfigSubSection>
  );
};
