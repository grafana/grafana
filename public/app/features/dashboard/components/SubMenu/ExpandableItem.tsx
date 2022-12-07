import React, { FC, ReactElement } from 'react';

import { SelectableValue } from '@grafana/data/src';
import { Icon, SegmentAsync } from '@grafana/ui/src';

interface Props {
  onChange: (item: SelectableValue<string | null>) => void;
  loadOptions: () => Promise<Array<SelectableValue<string>>>;
  disabled?: boolean;
}

const expandSegment: ReactElement = (
  <span className="gf-form-label query-part" aria-label="Add Filter">
    <Icon name="gf-show-context" />
  </span>
);

export const ExpandableItem: FC<Props> = ({ onChange, loadOptions, disabled }) => {
  const MIN_WIDTH = 90;

  return (
    <SegmentAsync
      disabled={disabled}
      className="query-segment-key"
      Component={expandSegment}
      onChange={onChange}
      loadOptions={loadOptions}
      inputMinWidth={MIN_WIDTH}
    />
  );
};
