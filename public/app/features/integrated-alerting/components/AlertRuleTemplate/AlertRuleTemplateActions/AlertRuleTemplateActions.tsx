import React, { FC, useState, useMemo } from 'react';
import { IconButton, useStyles } from '@grafana/ui';
import { EditAlertRuleTemplateModal } from '../EditAlertRuleTemplateModal/EditAlertRuleTemplateModal';
import { getStyles } from './AlertRuleTemplateActions.styles';
import { AlertRuleTemplateActionsProps } from './AlertRuleTemplateActions.types';
import { SourceDescription } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';

export const AlertRuleTemplateActions: FC<AlertRuleTemplateActionsProps> = ({ template, getAlertRuleTemplates }) => {
  const styles = useStyles(getStyles);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const { source, yaml } = template;
  const isEditDisabled = useMemo(() => source === SourceDescription.BUILT_IN, [template]);

  return (
    <div className={styles.actionsWrapper}>
      <IconButton
        data-qa="edit-template-button"
        name="pen"
        disabled={isEditDisabled}
        onClick={() => setEditModalVisible(true)}
      />
      <EditAlertRuleTemplateModal
        yaml={yaml}
        isVisible={editModalVisible}
        setVisible={setEditModalVisible}
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
    </div>
  );
};
