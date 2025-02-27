import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from 'app/core/internationalization';

import { KBObjectArray, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isRecordingRuleByType } from '../../utils/rules';

import { FolderSelector } from './FolderSelector';
import { RuleEditorSection, RuleEditorSubSection } from './RuleEditorSection';
import { LabelsEditorModal } from './labels/LabelsEditorModal';
import { LabelsFieldInForm } from './labels/LabelsFieldInForm';

/** Precondition: rule is Grafana managed.
 */
export function GrafanaFolderAndLabelsStep() {
  const { setValue, getValues } = useFormContext<RuleFormValues>();

  const type = getValues('type');
  const labels = getValues('labels');

  const [showLabelsEditor, setShowLabelsEditor] = useState(false);

  function onCloseLabelsEditor(labelsToUpdate?: KBObjectArray) {
    if (labelsToUpdate) {
      setValue('labels', labelsToUpdate);
    }
    setShowLabelsEditor(false);
  }

  const description = t(
    'alerting.rule-form.folder-and-labels',
    'Organize your alert rule with a folder and set of labels.'
  );

  const isRecordingRule = type ? isRecordingRuleByType(type) : false;

  return (
    <RuleEditorSection stepNo={3} title="Add folder and labels" description={description}>
      <RuleEditorSubSection
        title={<Trans i18nKey="alerting.rule-form.folder.label">Folder</Trans>}
        description="Select a folder to store your rule in."
        helpInfo={{
          title: t('alerting.rule-form.folder.label', 'Folder'),
          contentText: (
            <Trans i18nKey="alerting.rule-form.folders.help-info">
              Folders are used for storing alert rules. You can extend the access provided by a role to alert rules and
              assign permissions to individual folders.
            </Trans>
          ),
        }}
      >
        <FolderSelector />
      </RuleEditorSubSection>

      <RuleEditorSubSection
        title="Labels"
        description={
          isRecordingRule
            ? t('alerting.alertform.labels.recording', 'Add labels to your rule.')
            : t(
                'alerting.alertform.labels.alerting',
                'Add labels to your rule for searching, silencing, or routing to a notification policy.'
              )
        }
        helpInfo={{
          title: 'Labels',
          contentText: (
            <>
              <p>
                <Trans i18nKey="alerting.rule-form.labels.help-info">
                  Labels are used to differentiate an alert from all other alerts. You can use them for searching,
                  silencing, and routing notifications.
                </Trans>
              </p>
              <p>
                The dropdown only displays labels that you have previously used for alerts. Select a label from the
                options below or type in a new one.
              </p>
            </>
          ),
        }}
      >
        <LabelsFieldInForm onEditClick={() => setShowLabelsEditor(true)} />
        <LabelsEditorModal
          isOpen={showLabelsEditor}
          onClose={onCloseLabelsEditor}
          dataSourceName={GRAFANA_RULES_SOURCE_NAME}
          initialLabels={labels}
        />
      </RuleEditorSubSection>
    </RuleEditorSection>
  );
}
