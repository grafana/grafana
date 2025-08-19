import { useState } from 'react';

import { t } from '@grafana/i18n';
import { EditorRow, EditorFieldGroup, EditorField } from '@grafana/plugin-ui';
import { Input } from '@grafana/ui';

import { BuildAndUpdateOptions } from './utils';

interface LimitSectionProps {
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
}

export const LimitSection: React.FC<LimitSectionProps> = (props) => {
  const { buildAndUpdateQuery } = props;

  const [limit, setLimit] = useState<number>(1000);

  const handleQueryLimitUpdate = (newLimit: number) => {
    buildAndUpdateQuery({
      limit: newLimit,
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label={t('components.limit-section.label-limit', 'Limit')}
          optional={true}
          tooltip={t(
            'components.limit-section.tooltip-limit',
            'Restrict the number of rows returned (default is 1000).'
          )}
        >
          <Input
            className="width-5"
            type="number"
            placeholder={t('components.limit-section.placeholder-limit', 'Enter limit')}
            value={limit}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newValue = e.target.value.replace(/[^0-9]/g, '');
              setLimit(Number(newValue));
              handleQueryLimitUpdate(Number(newValue));
            }}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
