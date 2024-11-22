import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  DataTransformerConfig,
  GrafanaTheme2,
  StandardEditorContext,
  StandardEditorsRegistryItem,
} from '@grafana/data';
import { DataTopic } from '@grafana/schema';
import { Field, Select, useStyles2 } from '@grafana/ui';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import { TransformationData } from './TransformationsEditor';

interface TransformationFilterProps {
  index: number;
  config: DataTransformerConfig;
  data: TransformationData;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationFilter = ({ index, data, config, onChange }: TransformationFilterProps) => {
  const styles = useStyles2(getStyles);

  const opts = useMemo(() => {
    return {
      // eslint-disable-next-line
      context: { data: data.series } as StandardEditorContext<unknown>,
      showTopic: true || data.annotations?.length || config.topic?.length,
      showFilter: config.topic !== DataTopic.Annotations,
      source: [
        { value: DataTopic.Series, label: `Query results` },
        { value: DataTopic.Annotations, label: `Annotation data` },
      ],
    };
  }, [data, config.topic]);

  return (
    <div className={styles.wrapper}>
      <Field label="Apply transformation to">
        <>
          {opts.showTopic && (
            <Select
              isClearable={true}
              options={opts.source}
              value={opts.source.find((v) => v.value === config.topic)}
              placeholder={opts.source[0].label}
              className={styles.padded}
              onChange={(option) => {
                onChange(index, {
                  ...config,
                  topic: option?.value,
                });
              }}
            />
          )}
          {opts.showFilter && (
            <FrameMultiSelectionEditor
              value={config.filter!}
              context={opts.context}
              // eslint-disable-next-line
              item={{} as StandardEditorsRegistryItem}
              onChange={(filter) => onChange(index, { ...config, filter })}
            />
          )}
        </>
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.radius.default;

  return {
    wrapper: css({
      padding: theme.spacing(2),
      border: `2px solid ${theme.colors.background.secondary}`,
      borderTop: `none`,
      borderRadius: `0 0 ${borderRadius} ${borderRadius}`,
      position: `relative`,
      top: `-4px`,
    }),
    padded: css({
      marginBottom: theme.spacing(1),
    }),
  };
};
