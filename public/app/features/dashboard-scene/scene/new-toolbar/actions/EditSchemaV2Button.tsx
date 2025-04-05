import { Button, Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export const EditSchemaV2Button = ({ dashboard }: ToolbarActionProps) => (
  <Button
    size="sm"
    variant="secondary"
    tooltip={t('dashboard.toolbar.new.edit-dashboard-v2-schema.tooltip', 'Edit dashboard v2 schema')}
    icon={<Icon name="brackets-curly" size="lg" type="default" />}
    onClick={() => dashboard.openV2SchemaEditor()}
  />
);
