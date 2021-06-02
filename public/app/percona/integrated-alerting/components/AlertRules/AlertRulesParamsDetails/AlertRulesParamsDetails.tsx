import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { beautifyUnit } from '../../AlertRuleTemplate/AlertRuleTemplate.utils';
import { AlertRulesParamsDetailsProps } from './AlertRulesParamsDetails.types';
import { getStyles } from './AlertRulesParamsDetails.style';

export const AlertRulesParamsDetails: FC<AlertRulesParamsDetailsProps> = ({ params = [] }) => {
  const styles = useStyles(getStyles);
  return (
    <>
      {params.map(param => (
        <div key={param.name} data-qa="alert-rule-param" className={styles.paramWrapper}>
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
