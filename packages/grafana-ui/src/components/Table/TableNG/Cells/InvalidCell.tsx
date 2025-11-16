import { Trans } from '@grafana/i18n';
import { TableCellDisplayMode } from '@grafana/schema';

import { Badge } from '../../../Badge/Badge';
import { InvalidCellProps } from '../types';

import { getLocalizedDisplayModeName } from './i18n';
import { getAutoRendererDisplayMode } from './renderers';

export function InvalidCell({ field, cellOptions }: InvalidCellProps) {
  const cellType = cellOptions?.type ?? TableCellDisplayMode.Auto;
  const displayMode = getLocalizedDisplayModeName(
    cellType === TableCellDisplayMode.Auto ? getAutoRendererDisplayMode(field) : cellType
  );

  return (
    <Badge
      color="red"
      icon="ban"
      text={<Trans i18nKey="grafana-ui.table.invalid-field">Invalid data for {{ displayMode }} cell</Trans>}
    />
  );
}
