import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Select, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { GroupConditionItemType, GroupConditionValue } from './types';

interface Props {
  allConditions: GroupConditionValue;
  hasVariables: boolean;
  onAdd: (itemType: GroupConditionItemType) => void;
}

export const ConditionalRenderingGroupAdd = ({ allConditions, hasVariables, onAdd }: Props) => {
  const styles = useStyles2(getStyles);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => setIsVisible(false), [allConditions]);

  const options: Array<SelectableValue<GroupConditionItemType>> = useMemo(
    () => [
      { label: t('dashboard.conditional-rendering.group.add.data', 'Query result'), value: 'data' },
      {
        label: t('dashboard.conditional-rendering.group.add.variable', 'Template variable'),
        value: 'variable',
        isDisabled: !hasVariables,
      },
      {
        label: t('dashboard.conditional-rendering.group.add.interval', 'Dashboard time range less than'),
        value: 'interval',
      },
    ],
    [hasVariables]
  );

  return (
    <>
      {isVisible ? (
        <Select
          allowCustomValue={false}
          placeholder={t('dashboard.conditional-rendering.group.add.placeholder', 'Select rule type')}
          options={options}
          onChange={({ value }) => onAdd(value!)}
        />
      ) : null}

      <div className={styles.buttonContainer}>
        <Button icon="plus" variant="secondary" size="sm" fullWidth onClick={() => setIsVisible(true)}>
          <Trans i18nKey="dashboard.conditional-rendering.group.add.button">Add rule</Trans>
        </Button>
      </div>
    </>
  );
};

const getStyles = () => ({
  buttonContainer: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
});
