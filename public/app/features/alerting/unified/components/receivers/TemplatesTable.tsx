import { useStyles } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, Fragment, useMemo, useState } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { CollapseToggle } from '../CollapseToggle';
import { DetailsField } from '../DetailsField';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';

interface Props {
  config: AlertManagerCortexConfig;
}

export const TemplatesTable: FC<Props> = ({ config }) => {
  const [expandedTemplates, setExpandedTemplates] = useState<Record<string, boolean>>({});
  const tableStyles = useStyles(getAlertTableStyles);

  const templateRows = useMemo(() => Object.entries(config.template_files), [config]);

  return (
    <ReceiversSection
      title="Message templates"
      description="Templates construct the messages that get sent to the contact points."
      addButtonLabel="New templates"
    >
      <table className={tableStyles.table}>
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th>Template</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!templateRows.length && (
            <tr className={tableStyles.evenRow}>
              <td colSpan={3}>No templates defined.</td>
            </tr>
          )}
          {templateRows.map(([name, content], idx) => {
            const isExpanded = !!expandedTemplates[name];
            return (
              <Fragment key={name}>
                <tr key={name} className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                  <td>
                    <CollapseToggle
                      isCollapsed={!expandedTemplates[name]}
                      onToggle={() => setExpandedTemplates({ ...expandedTemplates, [name]: !isExpanded })}
                    />
                  </td>
                  <td>{name}</td>
                  <td className={tableStyles.actionsCell}>
                    <ActionButton icon="pen">Edit</ActionButton>
                    <ActionIcon tooltip="delete template" icon="trash-alt" />
                  </td>
                </tr>
                {isExpanded && (
                  <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                    <td></td>
                    <td colSpan={2}>
                      <DetailsField label="Description" horizontal={true}>
                        <pre>{content}</pre>
                      </DetailsField>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </ReceiversSection>
  );
};
