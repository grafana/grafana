import { Fragment, useState } from 'react';

import { logError } from '@grafana/runtime';
import { Badge, ConfirmModal, Tooltip, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';
import { CodeText } from 'app/features/alerting/unified/components/common/TextVariants';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction } from '../../hooks/useAbilities';
import { getAlertTableStyles } from '../../styles/table';
import { makeAMLink, stringifyErrorLike } from '../../utils/misc';
import { CollapseToggle } from '../CollapseToggle';
import { DetailsField } from '../DetailsField';
import { ProvisioningBadge } from '../Provisioning';
import {
  NotificationTemplate,
  useDeleteNotificationTemplate,
  useNotificationTemplateMetadata,
} from '../contact-points/useNotificationTemplates';
import { ActionIcon } from '../rules/ActionIcon';

import { TemplateEditor } from './TemplateEditor';

interface Props {
  alertManagerName: string;
  templates: NotificationTemplate[];
}

export const TemplatesTable = ({ alertManagerName, templates }: Props) => {
  const appNotification = useAppNotification();
  const [deleteTemplate] = useDeleteNotificationTemplate({ alertmanager: alertManagerName });

  const tableStyles = useStyles2(getAlertTableStyles);

  const [templateToDelete, setTemplateToDelete] = useState<NotificationTemplate | undefined>();

  const onDeleteTemplate = async () => {
    if (templateToDelete) {
      try {
        await deleteTemplate.execute({ uid: templateToDelete.uid });
        appNotification.success('Template deleted', `Template ${templateToDelete.title} has been deleted`);
      } catch (error) {
        appNotification.error('Error deleting template', `Error deleting template ${templateToDelete.title}`);

        const loggableError = error instanceof Error ? error : new Error(stringifyErrorLike(error));
        logError(loggableError);
      }
    }
    setTemplateToDelete(undefined);
  };

  return (
    <>
      <table className={tableStyles.table} data-testid="templates-table">
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th>
              <Trans i18nKey="alerting.templates-table.template-group">Template group</Trans>
            </th>
            <Authorize
              actions={[
                AlertmanagerAction.CreateNotificationTemplate,
                AlertmanagerAction.UpdateNotificationTemplate,
                AlertmanagerAction.DeleteNotificationTemplate,
              ]}
            >
              <th>
                <Trans i18nKey="alerting.templates-table.actions">Actions</Trans>
              </th>
            </Authorize>
          </tr>
        </thead>
        <tbody>
          {!templates.length && (
            <tr className={tableStyles.evenRow}>
              <td colSpan={3}>
                <Trans i18nKey="alerting.templates-table.no-templates-defined">No templates defined.</Trans>
              </td>
            </tr>
          )}
          {templates.map((notificationTemplate, idx) => (
            <TemplateRow
              key={notificationTemplate.uid}
              notificationTemplate={notificationTemplate}
              idx={idx}
              alertManagerName={alertManagerName}
              onDeleteClick={setTemplateToDelete}
            />
          ))}
        </tbody>
      </table>

      {!!templateToDelete && (
        <ConfirmModal
          isOpen={true}
          title={t('alerting.templates-table.title-delete-template-group', 'Delete template group')}
          body={`Are you sure you want to delete template group "${templateToDelete.title}"?`}
          confirmText="Yes, delete"
          onConfirm={onDeleteTemplate}
          onDismiss={() => setTemplateToDelete(undefined)}
        />
      )}
    </>
  );
};

interface TemplateRowProps {
  notificationTemplate: NotificationTemplate;
  idx: number;
  alertManagerName: string;
  onDeleteClick: (template: NotificationTemplate) => void;
}

function TemplateRow({ notificationTemplate, idx, alertManagerName, onDeleteClick }: TemplateRowProps) {
  const tableStyles = useStyles2(getAlertTableStyles);
  const isGrafanaAlertmanager = alertManagerName === GRAFANA_RULES_SOURCE_NAME;

  const [isExpanded, setIsExpanded] = useState(false);
  const { isProvisioned } = useNotificationTemplateMetadata(notificationTemplate);

  const { uid, title: name, content: template, missing } = notificationTemplate;
  const misconfiguredBadgeText = t('alerting.templates.misconfigured-badge-text', 'Misconfigured');
  return (
    <Fragment key={uid}>
      <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
        <td>
          <CollapseToggle isCollapsed={!isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />
        </td>
        <td>
          {name} {isProvisioned && <ProvisioningBadge />}{' '}
          {missing && !isGrafanaAlertmanager && (
            <Tooltip
              content={
                <>
                  <Trans i18nKey="alerting.templates.misconfigured-warning">This template is misconfigured.</Trans>
                  <br />
                  <Trans i18nKey="alerting.templates.misconfigured-warning-details">
                    Templates must be defined in both the <CodeText content="template_files" /> and{' '}
                    <CodeText content="templates" /> sections of your alertmanager configuration.
                  </Trans>
                </>
              }
            >
              <span>
                <Badge text={misconfiguredBadgeText} color="orange" />
              </span>
            </Tooltip>
          )}
        </td>
        <td className={tableStyles.actionsCell}>
          {isProvisioned && (
            <ActionIcon
              to={makeAMLink(`/alerting/notifications/templates/${encodeURIComponent(uid)}/edit`, alertManagerName)}
              tooltip={t('alerting.template-row.tooltip-view-template', 'view template')}
              icon="file-alt"
            />
          )}
          {!isProvisioned && (
            <Authorize actions={[AlertmanagerAction.UpdateNotificationTemplate]}>
              <ActionIcon
                to={makeAMLink(`/alerting/notifications/templates/${encodeURIComponent(uid)}/edit`, alertManagerName)}
                tooltip={t('alerting.template-row.tooltip-edit-template-group', 'Edit template group')}
                icon="pen"
              />
            </Authorize>
          )}
          <Authorize actions={[AlertmanagerAction.CreateNotificationTemplate]}>
            <ActionIcon
              to={makeAMLink(
                `/alerting/notifications/templates/${encodeURIComponent(uid)}/duplicate`,
                alertManagerName
              )}
              tooltip={t('alerting.template-row.tooltip-copy-template-group', 'Copy template group')}
              icon="copy"
            />
          </Authorize>
          {!isProvisioned && (
            <Authorize actions={[AlertmanagerAction.DeleteNotificationTemplate]}>
              <ActionIcon
                onClick={() => onDeleteClick(notificationTemplate)}
                tooltip={t('alerting.template-row.tooltip-delete-template-group', 'Delete template group')}
                icon="trash-alt"
              />
            </Authorize>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
          <td />
          <td colSpan={2}>
            <DetailsField label="" horizontal={true}>
              <TemplateEditor
                width={'auto'}
                height={'auto'}
                autoHeight={true}
                value={template}
                showLineNumbers={false}
                monacoOptions={{
                  readOnly: true,
                  scrollBeyondLastLine: false,
                }}
              />
            </DetailsField>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
