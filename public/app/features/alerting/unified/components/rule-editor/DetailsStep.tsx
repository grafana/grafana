import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Icon } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { HoverCard } from '../HoverCard';

import AnnotationsField from './AnnotationsField';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';

function getDescription(ruleType: RuleFormType | undefined) {
  const annotationsText = 'Add annotations to provide more context in your alert notifications.';

  if (ruleType === RuleFormType.cloudRecording) {
    return 'Select the Namespace and Group for your recording rule.';
  }
  const docsLink =
    'https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/variables-label-annotation';

  const HelpContent = () => (
    <div>
      <h6>
        <Icon name="question-circle" /> Annotations
      </h6>
      <div>
        Annotations add metadata to provide more information on the alert in your alert notifications. For example, add
        a Summary annotation to tell you which value caused the alert to fire or which server it happened on.
      </div>
      <div>Annotations can contain a combination of text and template code.</div>
      <div>
        <a href={docsLink} target="_blank" rel="noreferrer">
          Read about annotations
        </a>
      </div>
    </div>
  );
  const LinkToDocs = () => (
    <HoverCard content={<HelpContent />} placement={'bottom-start'}>
      <span>
        <Icon name="info-circle" size="sm" tabIndex={0} /> Need help?
      </span>
    </HoverCard>
  );
  if (ruleType === RuleFormType.grafana) {
    return (
      <span>
        {` ${annotationsText} `}
        <LinkToDocs />
      </span>
    );
  }
  if (ruleType === RuleFormType.cloudAlerting) {
    return (
      <span>
        {`Select the Namespace and evaluation group for your alert. ${annotationsText} `} <LinkToDocs />
      </span>
    );
  }
  return '';
}

export function DetailsStep() {
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const type = watch('type');

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 3 : 4}
      title={type === RuleFormType.cloudRecording ? 'Folder and group' : 'Add annotations'}
      description={getDescription(type)}
    >
      {(ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) &&
        dataSourceName && <GroupAndNamespaceFields rulesSourceName={dataSourceName} />}

      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
    </RuleEditorSection>
  );
}
