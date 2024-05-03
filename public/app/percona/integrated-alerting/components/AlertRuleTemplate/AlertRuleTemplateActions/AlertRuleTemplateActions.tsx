import { cx } from '@emotion/css';
import React, { FC, useState, useMemo } from 'react';

import { IconButton, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';

import { SourceDescription } from '../AlertRuleTemplate.types';
import { DeleteRuleTemplateModal } from '../DeleteRuleTemplateModal/DeleteRuleTemplateModal';
import { EditAlertRuleTemplateModal } from '../EditAlertRuleTemplateModal/EditAlertRuleTemplateModal';

import { getStyles } from './AlertRuleTemplateActions.styles';
import { AlertRuleTemplateActionsProps } from './AlertRuleTemplateActions.types';

const nonActionableSources = [SourceDescription.BUILT_IN, SourceDescription.USER_FILE, SourceDescription.SAAS];

export const AlertRuleTemplateActions: FC<AlertRuleTemplateActionsProps> = ({ template, getAlertRuleTemplates }) => {
  const styles = useStyles2(getStyles);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const { source, yaml, name, summary } = template;
  const isActionDisabled = useMemo(() => nonActionableSources.includes(source), [source]);

  return (
    <div className={styles.actionsWrapper}>
      <Tooltip placement="top" content="Create alert rule from this template">
        <LinkButton
          icon="plus"
          fill="text"
          href={`/alerting/new-from-template?returnTo=%2Falerting%2Falert-rule-templates&template=${template.name}`}
          data-testid="create-from-template-button"
        >
          Create alert rule
        </LinkButton>
      </Tooltip>
      {!isActionDisabled && (
        <>
          <Tooltip placement="top" content="Edit">
            <IconButton
              data-testid="edit-template-button"
              aria-label="Edit template"
              name="pen"
              size="lg"
              className={cx(styles.button, styles.editButton)}
              disabled={isActionDisabled}
              onClick={() => setEditModalVisible(true)}
            />
          </Tooltip>
          <Tooltip placement="top" content="Delete">
            <IconButton
              data-testid="delete-template-button"
              aria-label="Delete template"
              name="times"
              size="xl"
              className={cx(styles.button)}
              disabled={isActionDisabled}
              onClick={() => setDeleteModalVisible(true)}
            />
          </Tooltip>
        </>
      )}
      <EditAlertRuleTemplateModal
        yaml={yaml}
        name={name}
        summary={summary}
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
