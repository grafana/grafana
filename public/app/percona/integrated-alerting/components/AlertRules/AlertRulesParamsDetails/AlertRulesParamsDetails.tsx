import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { beautifyUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.utils';

import { getStyles } from './AlertRulesParamsDetails.style';
import { AlertRulesParamsDetailsProps } from './AlertRulesParamsDetails.types';

export const AlertRulesParamsDetails: FC<AlertRulesParamsDetailsProps> = ({ params = [] }) => {
  const styles = useStyles(getStyles);
  return (
    <>
      {params.map((param) => (
        <div key={param.name} data-testid="alert-rule-param" className={styles.paramWrapper}>
          <span className={styles.paramLabel}>{`${param.name}:`}</span>
          <span>
            {`${param.value} `}
            {beautifyUnit(param.unit)}
          </span>
        </div>
      ))}
    </>
  );
};
