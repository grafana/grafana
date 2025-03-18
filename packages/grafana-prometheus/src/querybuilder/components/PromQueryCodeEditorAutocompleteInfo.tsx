import { useState, useEffect, useCallback } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { IconButton, Text, Stack } from '@grafana/ui';

import {
  CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT,
  isSuggestionsIncompleteEvent,
} from '../../components/monaco-query-field/monaco-completion-provider/data_provider';
import { PromQueryEditorProps } from '../../components/types';
import { QueryEditorMode } from '../shared/types';

interface Props {
  datasourceUid: PromQueryEditorProps['datasource']['uid'];
  editorMode: QueryEditorMode;
}

export function PromQueryCodeEditorAutocompleteInfo(props: Readonly<Props>) {
  const [autocompleteLimit, setAutocompleteLimit] = useState('n');
  const [autocompleteLimitExceeded, setAutocompleteLimitExceeded] = useState(false);
  const handleSuggestionsIncompleteEvent = useCallback(
    (e: Event) => {
      if (!isSuggestionsIncompleteEvent(e)) {
        return;
      }

      if (e.detail.datasourceUid === props.datasourceUid) {
        setAutocompleteLimitExceeded(true);
        setAutocompleteLimit(e.detail.limit.toString());
      }
    },
    [props.datasourceUid]
  );

  useEffect(() => {
    addEventListener(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, handleSuggestionsIncompleteEvent);

    return () => {
      removeEventListener(CODE_MODE_SUGGESTIONS_INCOMPLETE_EVENT, handleSuggestionsIncompleteEvent);
    };
  }, [handleSuggestionsIncompleteEvent]);

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
      <Stack direction="row" gap={1}>
        <Text color="secondary" element="p" italic={true}>
          Autocomplete suggestions limited
        </Text>
        <IconButton
          name="info-circle"
          tooltip={`The number of metric names exceeds the autocomplete limit. Only the ${autocompleteLimit}-most relevant metrics are displayed. You can adjust the threshold in the data source settings.`}
        />
      </Stack>
    </div>
  );
}
