import React, { FC } from 'react';
import { Label } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

import { defaultXYPlotConfig, GraphOptions, XYPlotConfig } from '../types';
import { FieldMatcherEditor } from './FieldMatcherEditor';

export const XYPlotEditor: FC<StandardEditorProps<XYPlotConfig, any, GraphOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return (
    <div>
      <Label>X Fields</Label>
      <FieldMatcherEditor
        value={value.xFields || defaultXYPlotConfig.xFields!}
        data={context.data}
        onChange={xFields => onChange({ ...value, xFields })}
      />

      <Label>Y Fields</Label>
      <FieldMatcherEditor
        value={value.yFields || defaultXYPlotConfig.yFields!}
        data={context.data}
        onChange={yFields => onChange({ ...value, yFields })}
      />
    </div>
  );
};
