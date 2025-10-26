import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Field, Icon, Label, Stack, Tooltip } from '@grafana/ui';

import { SQLOptions } from '../../types';

import { NumberInput } from './NumberInput';

interface Props {
  labelWidth: number;
  onMaxConnectionsChanged: (number?: number) => void;
  jsonData: SQLOptions;
}

export function MaxOpenConnectionsField({ labelWidth, onMaxConnectionsChanged, jsonData }: Props) {
  return (
    <Field
      label={
        <Label>
          <Stack gap={0.5}>
            <span>
              <Trans i18nKey="grafana-sql.components.connection-limits.max-open">Max open</Trans>
            </span>
            <Tooltip
              content={
                <span>
                  <Trans i18nKey="grafana-sql.components.connection-limits.content-max-open">
                    The maximum number of open connections to the database. If <i>Max idle connections</i> is greater
                    than 0 and the <i>Max open connections</i> is less than <i>Max idle connections</i>, then
                    <i>Max idle connections</i> will be reduced to match the <i>Max open connections</i> limit. If set
                    to 0, there is no limit on the number of open connections.
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
        value={jsonData.maxOpenConns}
        defaultValue={config.sqlConnectionLimits.maxOpenConns}
        onChange={onMaxConnectionsChanged}
        width={labelWidth}
      />
    </Field>
  );
}
