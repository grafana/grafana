import React, { FC, useContext } from 'react';



import { AlertRulesProvider } from '../AlertRules.provider';

import { IconButton, useStyles } from '@grafana/ui';


import { getStyles } from './AlertRulesActions.styles';
import { AlertRulesActionsProps } from './AlertRulesActions.types';

export const AlertRulesActions: FC<AlertRulesActionsProps> = ({ alertRule }) => {
  const styles = useStyles(getStyles);
  const { setAddModalVisible, setSelectedAlertRule } = useContext(AlertRulesProvider);

  const handleEditClick = () => {
    setSelectedAlertRule(alertRule);
    setAddModalVisible(true);
  };

  return (
    <div className={styles.actionsWrapper}>
      <IconButton data-qa="edit-alert-rule-button" name="pen" onClick={handleEditClick} />
    </div>
  );
};
