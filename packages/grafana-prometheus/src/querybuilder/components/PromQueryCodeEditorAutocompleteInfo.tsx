import React, { useState, useEffect } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { IconButton, Text, Stack } from '@grafana/ui';

import {
  CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT,
  isSuggestionsIncompleteEvent,
} from '../../components/monaco-query-field/monaco-completion-provider/data-provider';
import { PromQueryEditorProps } from '../../components/types';
import { QueryEditorMode } from '../shared/types';

interface Props {
  datasourceUid: Pick<PromQueryEditorProps, 'datasource'>['datasource']['uid'];
  editorMode: QueryEditorMode;
}

export function PromQueryCodeEditorAutocompleteInfo(props: Readonly<Props>) {
  const [autocompleteLimit, setAutocompleteLimit] = useState('n');
  const [autocompleteLimitExceeded, setAutocompleteLimitExceeded] = useState(false);

  useEffect(() => {
    const handleSuggestionsIncompleteEvent = (e: Event) => {
      if (!isSuggestionsIncompleteEvent(e)) {
        return;
      }

      if (e.detail.datasourceUid === props.datasourceUid) {
        setAutocompleteLimitExceeded(true);
        setAutocompleteLimit(e.detail.limit.toString());
      }
    };

    window.addEventListener(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, handleSuggestionsIncompleteEvent);

    return () => {
      window.removeEventListener(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, handleSuggestionsIncompleteEvent);
    };
  }, [props.datasourceUid]);

  const showCodeModeAutocompleteDisclaimer = (): boolean => {
    return (
      Boolean(config.featureToggles.prometheusCodeModeMetricNamesSearch) &&
      props.editorMode === QueryEditorMode.Code &&
      autocompleteLimitExceeded
    );
  };

  if (!showCodeModeAutocompleteDisclaimer()) {
    return null;
  }

  return (
    <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsCountInfo}>
      <Stack direction="row" gap={0.25}>
        <IconButton
          name="info-circle"
          tooltip={`The number of metric names exceeds the maximum for autocomplete in the code editor. Only the ${autocompleteLimit}-most relevant metric names will be shown. The threshold for metric names used in code editor autocomplete can be configured in the Prometheus data source settings.`}
        />
        <Text color="secondary" element="p" italic={true}>
          Autocomplete suggestions limited
        </Text>
      </Stack>
    </div>
  );
}
