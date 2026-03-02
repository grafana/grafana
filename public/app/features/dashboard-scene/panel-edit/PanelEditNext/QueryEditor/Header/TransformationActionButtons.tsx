import { useCallback } from 'react';

import { FrameMatcherID } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

export function TransformationActionButtons() {
  const { selectedTransformation, transformToggles } = useQueryEditorUIContext();
  const { updateTransformation } = useActionsContext();
  const { data } = useQueryRunnerContext();

  // Toggle filter: add/remove the filter property from the transformation config.
  // Mirrors v1 (TransformationOperationRow): only `filter` is toggled here; `topic` is
  // managed independently by the filter UI and must not be clobbered on removal.
  const handleFilterToggle = useCallback(() => {
    if (!selectedTransformation) {
      return;
    }

    const current = selectedTransformation.transformConfig;

    if (current.filter) {
      const { filter, ...restConfig } = current;
      updateTransformation(current, restConfig);
    } else {
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

  // Mirror v1 behavior: only offer the filter action when it's meaningful — i.e., when a filter
  // is already configured (so the user can remove it), or when there's actual data to filter.
  const hasData = (data?.series?.length ?? 0) > 0 || (data?.annotations?.length ?? 0) > 0;
  const showFilterButton = isFilterActive || hasData;

  const helpLabel = transformToggles.showHelp
    ? t('query-editor-next.action.hide-transformation-help', 'Hide transformation help')
    : t('query-editor-next.action.show-transformation-help', 'Show transformation help');

  // Label describes the action the click will perform. `topic` is managed by the filter
  // UI separately, so only `filter` determines whether clicking will add or remove.
  const filterLabel =
    config.filter != null
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

      {showFilterButton && (
        <Button
          size="sm"
          fill="text"
          icon="filter"
          variant={isFilterActive ? 'primary' : 'secondary'}
          onClick={handleFilterToggle}
          tooltip={filterLabel}
          aria-label={filterLabel}
        />
      )}

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
