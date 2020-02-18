// Libraries
import React, { memo } from 'react';

// Types
import { FormLabel } from '@grafana/ui';

export interface LokiExploreExtraFieldProps {
  label: string;
  onChangeFunc: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  value: string;
  type?: string;
  min?: number;
}

export function LokiExploreExtraField(props: LokiExploreExtraFieldProps) {
  const { label, onChangeFunc, onKeyDownFunc, value, type, min } = props;

  return (
    <div className="gf-form-inline explore-input--ml">
      <div className="gf-form">
        <FormLabel width={6}>{label}</FormLabel>
        <input
          type={type}
          className="gf-form-input width-6"
          placeholder={'auto'}
          onChange={onChangeFunc}
          onKeyDown={onKeyDownFunc}
          min={min}
          value={value}
        />
      </div>
    </div>
  );
}

export default memo(LokiExploreExtraField);
