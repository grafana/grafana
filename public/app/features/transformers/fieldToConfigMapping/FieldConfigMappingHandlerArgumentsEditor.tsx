import React from 'react';

import { ColorPicker, Input } from '@grafana/ui';

import { HandlerArguments } from './fieldToConfigMapping';

export interface Props {
  handlerKey: string | null;
  handlerArguments: HandlerArguments;
  onChange: (args: HandlerArguments) => void;
}

export function FieldConfigMappingHandlerArgumentsEditor({ handlerArguments, handlerKey, onChange }: Props) {
  const onChangeThreshold = (color: string | null) => {
    if (color) {
      onChange({
        ...handlerArguments,
        threshold: {
          ...handlerArguments.threshold,
          color: color,
        },
      });
    } else {
      onChange({ ...handlerArguments, threshold: undefined });
    }
  };

  return (
    <>
      {handlerKey === 'threshold1' && (
        <Input
          type="text"
          value={'Threshold color'}
          aria-label={'Threshold color'}
          disabled
          width={20}
          prefix={
            <div>
              <ColorPicker
                color={handlerArguments.threshold?.color ?? 'red'}
                onChange={onChangeThreshold}
                enableNamedColors={true}
              />
            </div>
          }
        />
      )}
    </>
  );
}
