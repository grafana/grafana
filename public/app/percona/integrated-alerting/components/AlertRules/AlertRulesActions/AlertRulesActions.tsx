import React, { FC, useContext, useState } from 'react';
import { IconButton, Switch, Spinner, useStyles, Tooltip } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { logger } from '@percona/platform-core';
import { appEvents } from 'app/core/app_events';
import { getStyles } from './AlertRulesActions.styles';
import { AlertRulesActionsProps } from './AlertRulesActions.types';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesService } from '../AlertRules.service';
import { Messages } from './AlertRulesActions.messages';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { createAlertRuleCopyPayload } from './AlertRulesActions.utils';

export const AlertRulesActions: FC<AlertRulesActionsProps> = ({ alertRule }) => {
  const styles = useStyles(getStyles);
  const [pendingRequest, setPendingRequest] = useState(false);
  const { ruleId, name, disabled } = alertRule;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const { setAddModalVisible, setSelectedAlertRule, getAlertRules } = useContext(AlertRulesProvider);

  const handleEditClick = () => {
    setSelectedAlertRule(alertRule);
    setAddModalVisible(true);
  };

  const deleteAlertRule = async () => {
    setPendingRequest(true);
    try {
      await AlertRulesService.delete({ rule_id: ruleId });
      appEvents.emit(AppEvents.alertSuccess, [Messages.getDeletedMessage(name)]);
      getAlertRules();
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteModalVisible(true);
  };

  const handleCopyClick = async () => {
    setPendingRequest(true);

    const newName = `${Messages.copyOf} ${alertRule.name}`;

    try {
      await AlertRulesService.create(createAlertRuleCopyPayload(alertRule));
      appEvents.emit(AppEvents.alertSuccess, [Messages.getCreatedMessage(newName)]);
      getAlertRules();
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  const toggleAlertRule = async () => {
    setPendingRequest(true);
    try {
      await AlertRulesService.toggle({
        rule_id: ruleId,
        disabled: disabled ? 'FALSE' : 'TRUE',
      });
      appEvents.emit(AppEvents.alertSuccess, [
        disabled ? Messages.getEnabledMessage(name) : Messages.getDisabledMessage(name),
      ]);
      getAlertRules();
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  return (
    <div className={styles.actionsWrapper}>
      {pendingRequest ? (
        <Spinner />
      ) : (
        <>
          <Switch value={!disabled} onClick={toggleAlertRule} data-testid="toggle-alert-rule" />
          <Tooltip placement="top" content="Edit">
            <IconButton data-testid="edit-alert-rule-button" name="pen" onClick={handleEditClick} />
          </Tooltip>
          <Tooltip placement="top" content="Delete">
            <IconButton data-testid="delete-alert-rule-button" name="times" size="xl" onClick={handleDeleteClick} />
          </Tooltip>
          <Tooltip placement="top" content="Copy">
            <IconButton data-testid="copy-alert-rule-button" name="copy" onClick={handleCopyClick} />
          </Tooltip>
        </>
      )}
      <DeleteModal
        data-testid="alert-rule-delete-modal"
        title={Messages.deleteModalTitle}
        message={Messages.getDeleteModalMessage(name)}
        loading={pendingRequest}
        isVisible={deleteModalVisible}
        setVisible={setDeleteModalVisible}
        onDelete={deleteAlertRule}
      />
    </div>
  );
};
