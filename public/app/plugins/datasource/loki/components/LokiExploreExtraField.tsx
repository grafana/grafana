// Libraries
import React, { memo } from 'react';

// Types
import { FormLabel } from '@grafana/ui';

interface LokiExploreExtraFieldProps {
  label: string;
  onChangeFunc: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  value: string;
}

export const LokiExploreExtraField = memo(function LokiExploreExtraField(props: LokiExploreExtraFieldProps) {
  const { label, onChangeFunc, onKeyDownFunc, value } = props;

  return (
    <div className="gf-form-inline explore-input--ml">
      <div className="gf-form">
        <FormLabel width={6}>{label}</FormLabel>
        <input
          type="text"
          className="gf-form-input width-6"
          placeholder={'auto'}
          onChange={onChangeFunc}
          onKeyDown={onKeyDownFunc}
          value={value}
        />
      </div>
    </div>
  );
});

export default LokiExploreExtraField;
