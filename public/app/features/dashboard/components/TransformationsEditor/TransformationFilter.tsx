import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import {
  DataTransformerConfig,
  GrafanaTheme2,
  SelectableValue,
  StandardEditorContext,
  StandardEditorsRegistryItem,
} from '@grafana/data';
import { DataTopic } from '@grafana/schema';
import { Field, Select, useStyles2 } from '@grafana/ui';
import { FrameSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import { TransformationData } from './TransformationsEditor';

interface TransformationFilterProps {
  index: number;
  config: DataTransformerConfig;
  data: TransformationData;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

const dataFramesSourceOpts: Array<SelectableValue<DataTopic>> = [
  { value: DataTopic.Series, label: 'Series' },
  { value: DataTopic.Annotations, label: 'Annotations' },
];

export const TransformationFilter = ({ index, data, config, onChange }: TransformationFilterProps) => {
  const styles = useStyles2(getStyles);
  const context = useMemo(() => {
    // eslint-disable-next-line
    return { data: data.series } as StandardEditorContext<unknown>;
  }, [data]);

  return (
    <>
      <div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <div className="gf-form-label width-8">Topic</div>
            <Select
              className="width-18"
              options={dataFramesSourceOpts}
              value={dataFramesSourceOpts.find((v) => v.value === config.topic)}
              onChange={(option) => {
                onChange(index, {
                  ...config,
                  topic: option.value,
                });
              }}
            />
          </div>
        </div>
      </div>
      <div className={styles.wrapper}>
        <Field label="Apply transformation to">
          <FrameSelectionEditor
            value={config.filter!}
            context={context}
            // eslint-disable-next-line
            item={{} as StandardEditorsRegistryItem}
            onChange={(filter) => onChange(index, { ...config, filter })}
          />
        </Field>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.radius.default;

  return {
    wrapper: css`
      padding: ${theme.spacing(2)};
      border: 2px solid ${theme.colors.background.secondary};
      border-top: none;
      border-radius: 0 0 ${borderRadius} ${borderRadius};
      position: relative;
      top: -4px;
    `,
  };
};
