import React, { FC, useState, useMemo } from 'react';
import { IconButton, useStyles } from '@grafana/ui';
import { EditAlertRuleTemplateModal } from '../EditAlertRuleTemplateModal/EditAlertRuleTemplateModal';
import { getStyles } from './AlertRuleTemplateActions.styles';
import { AlertRuleTemplateActionsProps } from './AlertRuleTemplateActions.types';
import { SourceDescription } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';
import { DeleteRuleTemplateModal } from '../DeleteRuleTemplateModal/DeleteRuleTemplateModal';

export const AlertRuleTemplateActions: FC<AlertRuleTemplateActionsProps> = ({ template, getAlertRuleTemplates }) => {
  const styles = useStyles(getStyles);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const { source, yaml } = template;
  const isActionDisabled = useMemo(() => source === SourceDescription.BUILT_IN, [template]);

  return (
    <div className={styles.actionsWrapper}>
      <IconButton
        data-qa="edit-template-button"
        name="pen"
        disabled={isActionDisabled}
        onClick={() => setEditModalVisible(true)}
      />
      <IconButton
        data-qa="delete-template-button"
        name="times"
        disabled={isActionDisabled}
        onClick={() => setDeleteModalVisible(true)}
      />
      <EditAlertRuleTemplateModal
        yaml={yaml}
        isVisible={editModalVisible}
        setVisible={setEditModalVisible}
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
      <DeleteRuleTemplateModal
        template={template}
        setVisible={setDeleteModalVisible}
        getAlertRuleTemplates={getAlertRuleTemplates}
        isVisible={deleteModalVisible}
      />
    </div>
  );
};
