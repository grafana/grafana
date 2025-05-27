import { config } from '@grafana/runtime';
import { Field, Icon, Label, Stack, Tooltip } from '@grafana/ui';

import { SQLOptions } from '../../types';

import { NumberInput } from './NumberInput';

interface Props {
  labelWidth: number;
  onMaxLifetimeChanged: (number?: number) => void;
  jsonData: SQLOptions;
}
export function MaxLifetimeField({ labelWidth, onMaxLifetimeChanged, jsonData }: Props) {
  return (
    <Field
      label={
        <Label>
          <Stack gap={0.5}>
            <span>Max lifetime</span>
            <Tooltip
              content={
                <span>
                  The maximum amount of time in seconds a connection may be reused. If set to 0, connections are reused
                  forever.
                </span>
              }
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </Stack>
        </Label>
      }
    >
      <NumberInput
        value={jsonData.connMaxLifetime}
        defaultValue={config.sqlConnectionLimits.connMaxLifetime}
        onChange={onMaxLifetimeChanged}
        width={labelWidth}
      />
    </Field>
  );
}
