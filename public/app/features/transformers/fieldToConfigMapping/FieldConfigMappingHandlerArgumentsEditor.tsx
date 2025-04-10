import { ColorPicker, Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { HandlerArguments } from './fieldToConfigMapping';

export interface Props {
  handlerKey: string | null;
  handlerArguments: HandlerArguments;
  onChange: (args: HandlerArguments) => void;
}

export function createsArgumentsEditor(handlerKey: string | null) {
  switch (handlerKey) {
    case 'threshold1':
      return true;
    default:
      return false;
  }
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
          aria-label={t(
            'transformers.field-config-mapping-handler-arguments-editor.aria-label-threshold-color',
            'Threshold color'
          )}
          disabled
          width={20}
          prefix={
            <ColorPicker
              color={handlerArguments.threshold?.color ?? 'red'}
              onChange={onChangeThreshold}
              enableNamedColors={true}
            />
          }
        />
      )}
    </>
  );
}
