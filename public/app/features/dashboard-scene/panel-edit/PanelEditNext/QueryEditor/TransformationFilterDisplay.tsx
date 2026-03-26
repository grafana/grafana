import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataTopic } from '@grafana/schema';
import { Combobox, Field, Stack, useStyles2 } from '@grafana/ui';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { usePreviousTransformationOutput } from './hooks/usePreviousTransformationOutput';

/**
 * Displays transformation filter options to control which data frames
 * the transformation applies to. This is shown inline in the editor
 * when a filter property exists on the transformation config.
 *
 * Shows the output of the previous transformation (or raw query data if this is the first transformation).
 */
export function TransformationFilterDisplay() {
  const { selectedTransformation } = useQueryEditorUIContext();
  const { data } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { updateTransformation } = useActionsContext();

  const styles = useStyles2(getStyles);

  const prevOutput = usePreviousTransformationOutput({
    selectedTransformation,
    transformations,
    queryData: data?.series ?? [],
    queryTargets: data?.request?.targets,
  });

  const onChange = useCallback(
    (newConfig: DataTransformerConfig) => {
      if (selectedTransformation) {
        updateTransformation(selectedTransformation.transformConfig, newConfig);
      }
    },
    [selectedTransformation, updateTransformation]
  );

  const filterOptions = useMemo(() => {
    const config = selectedTransformation?.transformConfig;

    return {
      context: { data: prevOutput },
      showTopic: true,
      showFilter: config?.topic !== DataTopic.Annotations,
      source: [
        {
          value: DataTopic.Series,
          label: t('query-editor-next.transformation-filter.series', 'Query and Transformation results'),
        },
        {
          value: DataTopic.Annotations,
          label: t('query-editor-next.transformation-filter.annotations', 'Annotation data'),
        },
      ],
    };
  }, [selectedTransformation, prevOutput]);

  if (!selectedTransformation) {
    return null;
  }

  const config = selectedTransformation.transformConfig;

  // Only show filter if it's configured on the transformation
  // Note: `topic` is a related filter property for annotation filtering
  const shouldShowFilter = config.filter != null || config.topic != null;

  if (!shouldShowFilter) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Field
        className={styles.field}
        noMargin
        label={t('query-editor-next.transformation-filter.label', 'Apply transformation to')}
      >
        <Stack direction="column" gap={1}>
          {filterOptions.showTopic && (
            <Combobox
              isClearable={true}
              options={filterOptions.source}
              value={config.topic}
              placeholder={filterOptions.source[0].label}
              onChange={(option) => {
                onChange({
                  ...config,
                  topic: option?.value,
                });
              }}
            />
          )}
          {filterOptions.showFilter && config.filter && (
            <FrameMultiSelectionEditor
              value={config.filter}
              context={filterOptions.context}
              onChange={(filter) => onChange({ ...config, filter })}
            />
          )}
        </Stack>
      </Field>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    padding: theme.spacing(2),
    border: `2px solid ${theme.colors.background.secondary}`,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(2),
  }),
  field: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
