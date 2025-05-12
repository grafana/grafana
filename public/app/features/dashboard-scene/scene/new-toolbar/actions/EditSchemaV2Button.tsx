import { useTranslate } from '@grafana/i18n';
import { Button, Icon } from '@grafana/ui';

import { ToolbarActionProps } from '../types';

export const EditSchemaV2Button = ({ dashboard }: ToolbarActionProps) => {
  const { t } = useTranslate();

  return (
    <Button
      size="sm"
      variant="secondary"
      tooltip={t('dashboard.toolbar.new.edit-dashboard-v2-schema.tooltip', 'Edit dashboard v2 schema')}
      icon={<Icon name="brackets-curly" size="lg" type="default" />}
      onClick={() => dashboard.openV2SchemaEditor()}
    />
  );
};
