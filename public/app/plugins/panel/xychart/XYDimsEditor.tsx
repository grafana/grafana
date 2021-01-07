import React, { FC } from 'react';
import { Label, VerticalGroup } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';

import { defaultXYDimensions, GraphOptions, XYDimensions } from './types';
import { FieldMatcherEditor } from './FieldMatcherEditor';

export const XYDimsEditor: FC<StandardEditorProps<XYDimensions, any, GraphOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return (
    <div>
      <Label>X Fields</Label>
      <FieldMatcherEditor
        value={value?.xFields || defaultXYDimensions.xFields!}
        data={context.data}
        onChange={xFields => onChange({ ...value, xFields })}
      />
      <br /> <br />
      <Label>Y Fields</Label>
      <FieldMatcherEditor
        value={value?.yFields || defaultXYDimensions.yFields!}
        data={context.data}
        onChange={yFields => onChange({ ...value, yFields })}
      />
      <br /> <br />
    </div>
  );
};
