import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import {
  DataFrame,
  DataTransformerConfig,
  GrafanaTheme2,
  StandardEditorContext,
  StandardEditorsRegistryItem,
} from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { FrameSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

interface TransformationFilterProps {
  index: number;
  config: DataTransformerConfig;
  data: DataFrame[];
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationFilter = ({ index, data, config, onChange }: TransformationFilterProps) => {
  const styles = useStyles2(getStyles);
  const context = useMemo(() => {
    // eslint-disable-next-line
    return { data } as StandardEditorContext<unknown>;
  }, [data]);

  return (
    <div className={styles.wrapper}>
      <h5>Apply tranformation to</h5>
      <FrameSelectionEditor
        value={config.filter!}
        context={context}
        // eslint-disable-next-line
        item={{} as StandardEditorsRegistryItem}
        onChange={(filter) => onChange(index, { ...config, filter })}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.borderRadius();

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
