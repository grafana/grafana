import { Fragment, useState } from 'react';

import { ConfirmModal, useStyles2 } from '@grafana/ui';

import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction } from '../../hooks/useAbilities';
import { getAlertTableStyles } from '../../styles/table';
import { PROVENANCE_NONE } from '../../utils/k8s/constants';
import { makeAMLink } from '../../utils/misc';
import { CollapseToggle } from '../CollapseToggle';
import { DetailsField } from '../DetailsField';
import { ProvisioningBadge } from '../Provisioning';
import { NotificationTemplate, useDeleteNotificationTemplate } from '../contact-points/useNotificationTemplates';
import { ActionIcon } from '../rules/ActionIcon';

import { TemplateEditor } from './TemplateEditor';

interface Props {
  alertManagerName: string;
  templates: NotificationTemplate[];
}

export const TemplatesTable = ({ alertManagerName, templates }: Props) => {
  const deleteTemplate = useDeleteNotificationTemplate({ alertmanager: alertManagerName });

  const [expandedTemplates, setExpandedTemplates] = useState<Record<string, boolean>>({});
  const tableStyles = useStyles2(getAlertTableStyles);

  const [templateToDelete, setTemplateToDelete] = useState<string>();

  const onDeleteTemplate = async () => {
    if (templateToDelete) {
      await deleteTemplate({ name: templateToDelete });
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
            <th></th>
            <th>Template</th>
            <Authorize
              actions={[
                AlertmanagerAction.CreateNotificationTemplate,
                AlertmanagerAction.UpdateNotificationTemplate,
                AlertmanagerAction.DeleteNotificationTemplate,
              ]}
            >
              <th>Actions</th>
            </Authorize>
          </tr>
        </thead>
        <tbody>
          {!templates.length && (
            <tr className={tableStyles.evenRow}>
              <td colSpan={3}>No templates defined.</td>
            </tr>
          )}
          {templates.map(({ name, template, provenance }, idx) => {
            const isProvisioned = provenance !== PROVENANCE_NONE;
            const isExpanded = expandedTemplates[name];
            return (
              <Fragment key={name}>
                <tr key={name} className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                  <td>
                    <CollapseToggle
                      isCollapsed={!expandedTemplates[name]}
                      onToggle={() => setExpandedTemplates({ ...expandedTemplates, [name]: !isExpanded })}
                    />
                  </td>
                  <td>
                    {name} {isProvisioned && <ProvisioningBadge />}
                  </td>
                  <td className={tableStyles.actionsCell}>
                    {isProvisioned && (
                      <ActionIcon
                        to={makeAMLink(
                          `/alerting/notifications/templates/${encodeURIComponent(name)}/edit`,
                          alertManagerName
                        )}
                        tooltip="view template"
                        icon="file-alt"
                      />
                    )}
                    {!isProvisioned && (
                      <Authorize actions={[AlertmanagerAction.UpdateNotificationTemplate]}>
                        <ActionIcon
                          to={makeAMLink(
                            `/alerting/notifications/templates/${encodeURIComponent(name)}/edit`,
                            alertManagerName
                          )}
                          tooltip="edit template"
                          icon="pen"
                        />
                      </Authorize>
                    )}
                    <Authorize actions={[AlertmanagerAction.CreateContactPoint]}>
                      <ActionIcon
                        to={makeAMLink(
                          `/alerting/notifications/templates/${encodeURIComponent(name)}/duplicate`,
                          alertManagerName
                        )}
                        tooltip="Copy template"
                        icon="copy"
                      />
                    </Authorize>
                    {!isProvisioned && (
                      <Authorize actions={[AlertmanagerAction.DeleteNotificationTemplate]}>
                        <ActionIcon
                          onClick={() => setTemplateToDelete(name)}
                          tooltip="delete template"
                          icon="trash-alt"
                        />
                      </Authorize>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                    <td></td>
                    <td colSpan={2}>
                      <DetailsField label="Description" horizontal={true}>
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
          })}
        </tbody>
      </table>

      {!!templateToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete template"
          body={`Are you sure you want to delete template "${templateToDelete}"?`}
          confirmText="Yes, delete"
          onConfirm={onDeleteTemplate}
          onDismiss={() => setTemplateToDelete(undefined)}
        />
      )}
    </>
  );
};
