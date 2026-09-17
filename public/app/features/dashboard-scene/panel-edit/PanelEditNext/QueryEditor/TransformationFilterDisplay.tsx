import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { type DataFrame, type DataTransformerConfig, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataTopic } from '@grafana/schema';
import { Combobox, Field, Stack, useStyles2 } from '@grafana/ui';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import { usePreviousTransformationOutput } from './hooks/usePreviousTransformationOutput';
import { type Transformation } from './types';

interface TransformationFilterEditorProps {
  transformation: Transformation | null;
  transformations: Transformation[];
  queryData?: PanelData;
  onUpdate: (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => void;
}

/** Stable identity for "the query has not returned anything yet". */
const NO_SERIES: DataFrame[] = [];

/**
 * Displays transformation filter options to control which data frames
 * the transformation applies to. This is shown inline in the editor
 * when a filter property exists on the transformation config.
 *
 * Shows the output of the previous transformation (or raw query data if this is the first transformation).
 */
export function TransformationFilterEditor({
  transformation,
  transformations,
  queryData,
  onUpdate,
}: TransformationFilterEditorProps) {
  const styles = useStyles2(getStyles);

  // Hoisted so the fallback is not a fresh array on every render: `useTransformedFrames` treats a
  // new array as a new generation, and its two sibling call sites memoize the same expression.
  const series = useMemo(() => queryData?.series ?? NO_SERIES, [queryData?.series]);

  const prevOutput = usePreviousTransformationOutput({
    selectedTransformation: transformation,
    transformations,
    queryData: series,
    queryTargets: queryData?.request?.targets,
  });

  const onChange = useCallback(
    (newConfig: DataTransformerConfig) => {
      if (transformation) {
        onUpdate(transformation.transformConfig, newConfig);
      }
    },
    [transformation, onUpdate]
  );

  const filterOptions = useMemo(() => {
    const config = transformation?.transformConfig;

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
  }, [transformation, prevOutput]);

  if (!transformation) {
    return null;
  }

  const config = transformation.transformConfig;

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
