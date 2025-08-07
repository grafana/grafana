import { Trans } from '@grafana/i18n';
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
            <span>
              <Trans i18nKey="grafana-sql.components.connection-limits.max-lifetime">Max lifetime</Trans>
            </span>
            <Tooltip
              content={
                <span>
                  <Trans i18nKey="grafana-sql.components.connection-limits.content-max-lifetime">
                    The maximum amount of time in seconds a connection may be reused. If set to 0, connections are
                    reused forever.
                  </Trans>
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
