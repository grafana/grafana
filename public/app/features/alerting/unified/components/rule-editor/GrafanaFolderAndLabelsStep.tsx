import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { KBObjectArray, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { FolderSelector } from './FolderSelector';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
import { LabelsEditorModal } from './labels/LabelsEditorModal';
import { LabelsFieldInForm } from './labels/LabelsFieldInForm';

/** Precondition: rule is Grafana managed.
 */
export function GrafanaFolderAndLabelsStep() {
  const { setValue, getValues } = useFormContext<RuleFormValues>();
  const [showLabelsEditor, setShowLabelsEditor] = useState(false);

  function onCloseLabelsEditor(labelsToUpdate?: KBObjectArray) {
    if (labelsToUpdate) {
      setValue('labels', labelsToUpdate);
    }
    setShowLabelsEditor(false);
  }

  function SectionDescription() {
    return (
      <Stack direction="row" gap={0.5} alignItems="center">
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.rule-form.folder-and-labels">
            Organize your alert rule with a folder and set of labels.
          </Trans>
        </Text>
        <NeedHelpInfo
          contentText={
            <>
              <p>
                {t(
                  'alerting.rule-form.folders.help-info',
                  'Folders are used for storing alert rules. You can extend the access provided by a role to alert rules and assign permissions to individual folders.'
                )}
              </p>
              <p>
                {t(
                  'alerting.rule-form.labels.help-info',
                  'Labels are used to differentiate an alert from all other alerts.You can use them for searching, silencing, and routing notifications.'
                )}
              </p>
            </>
          }
        />
      </Stack>
    );
  }

  return (
    <RuleEditorSection stepNo={3} title="Add folder and labels" description={<SectionDescription />}>
      <Stack direction="column" justify-content="flex-start" align-items="flex-start">
        <FolderSelector />
        <LabelsFieldInForm onEditClick={() => setShowLabelsEditor(true)} />
        <LabelsEditorModal
          isOpen={showLabelsEditor}
          onClose={onCloseLabelsEditor}
          dataSourceName={GRAFANA_RULES_SOURCE_NAME}
          initialLabels={getValues('labels')}
        />
      </Stack>
    </RuleEditorSection>
  );
}
