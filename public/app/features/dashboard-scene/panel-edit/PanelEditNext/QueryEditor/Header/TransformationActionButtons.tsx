import { useCallback } from 'react';

import { FrameMatcherID } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function TransformationActionButtons() {
  const { selectedTransformation, transformToggles } = useQueryEditorUIContext();
  const { updateTransformation } = useActionsContext();

  // Toggle filter: add/remove the filter property from the transformation config
  // Display will automatically show/hide based on whether the filter property exists
  const handleFilterToggle = useCallback(() => {
    if (!selectedTransformation) {
      return;
    }

    const current = selectedTransformation.transformConfig;

    if (current.filter || current.topic) {
      // Remove filter if it exists
      const { filter, topic, ...restConfig } = current;
      updateTransformation(current, restConfig);
    } else {
      // Add filter if it doesn't exist
      updateTransformation(current, {
        ...current,
        filter: {
          id: FrameMatcherID.byRefId,
          options: '',
        },
      });
    }
  }, [selectedTransformation, updateTransformation]);

  if (!selectedTransformation) {
    return null;
  }

  const hasHelp = selectedTransformation.registryItem?.help;
  const config = selectedTransformation.transformConfig;

  // Show filter button as active if filter property exists on the transformation config
  // Note: `topic` is a related filter property for annotation filtering
  const isFilterActive = config.filter != null || config.topic != null;

  const helpLabel = transformToggles.showHelp
    ? t('query-editor-next.action.hide-transformation-help', 'Hide transformation help')
    : t('query-editor-next.action.show-transformation-help', 'Show transformation help');

  // Filter button label
  const filterLabel = isFilterActive
    ? t('query-editor-next.action.remove-transformation-filter', 'Remove filter')
    : t('query-editor-next.action.add-transformation-filter', 'Add filter');

  return (
    <Stack gap={1}>
      {hasHelp && (
        <Button
          size="sm"
          fill="text"
          icon="question-circle"
          variant={transformToggles.showHelp ? 'primary' : 'secondary'}
          onClick={transformToggles.toggleHelp}
          tooltip={helpLabel}
          aria-label={helpLabel}
        />
      )}

      <Button
        size="sm"
        fill="text"
        icon="filter"
        variant={isFilterActive ? 'primary' : 'secondary'}
        onClick={handleFilterToggle}
        tooltip={filterLabel}
        aria-label={filterLabel}
      />

      <Button
        size="sm"
        fill="text"
        icon="bug"
        variant={transformToggles.showDebug ? 'primary' : 'secondary'}
        onClick={transformToggles.toggleDebug}
        tooltip={t('query-editor-next.action.transformation-debug', 'Debug')}
        aria-label={t('query-editor-next.action.transformation-debug', 'Debug')}
      />
    </Stack>
  );
}
