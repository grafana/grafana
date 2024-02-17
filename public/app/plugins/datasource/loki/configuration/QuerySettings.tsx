import React from 'react';

import { ConfigDescriptionLink, ConfigSubSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge, InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui';

type Props = {
  maxLines: string;
  onMaxLinedChange: (value: string) => void;
  hasLabelsMatchAPISupport: boolean;
  onHasLabelsMatchAPISupportChange: (value: boolean) => void;
  predefinedOperations: string;
  onPredefinedOperationsChange: (value: string) => void;
};

export const QuerySettings = (props: Props) => {
  const {
    maxLines,
    onMaxLinedChange,
    hasLabelsMatchAPISupport,
    onHasLabelsMatchAPISupportChange,
    predefinedOperations,
    onPredefinedOperationsChange,
  } = props;
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

      <InlineField
        label="Labels match API"
        htmlFor="loki_config_hasLabelsMatchAPISupport"
        labelWidth={22}
        tooltip={
          <>
            Choose the query endpoint for fetching label values: Check Labels match API to use /label/__name__/values
            endpoint for all label values queries. If unchecked (default), the /series endpoint will be used for queries
            with stream selectors.
          </>
        }
      >
        <InlineSwitch
          value={hasLabelsMatchAPISupport ?? false}
          onChange={(event: React.FormEvent<HTMLInputElement>) =>
            onHasLabelsMatchAPISupportChange(event.currentTarget.checked)
          }
          id="loki_config_hasLabelsMatchAPISupport"
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
