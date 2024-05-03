import React, { FC, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { useStyles2 } from '@grafana/ui';
import { useFolderGroupOptions } from 'app/features/alerting/unified/components/rule-editor/FolderAndGroup';
import { TemplatedAlertFormValues } from 'app/percona/integrated-alerting/types';

import { getStyles } from './EvaluateEvery.styles';

export const EvaluateEvery: FC = () => {
  const styles = useStyles2(getStyles);

  const { watch } = useFormContext<TemplatedAlertFormValues>();
  const folder = watch('folder');
  const group = watch('group');

  const { groupOptions } = useFolderGroupOptions(folder?.uid || '', false);
  const groupOption = useMemo(() => groupOptions.find((option) => option.label === group), [groupOptions, group]);

  const evaluateEvery = watch('evaluateEvery');

  if (!groupOption && !evaluateEvery) {
    return null;
  }

  return (
    <div className={styles.text}>
      All rules in the selected group are evaluated every {groupOption ? groupOption.description : evaluateEvery}.
    </div>
  );
};
