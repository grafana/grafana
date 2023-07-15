import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

import AnnotationsField from './AnnotationsField';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';

function getDescription(ruleType: RuleFormType | undefined, styles: { [key: string]: string }) {
  const annotationsText = 'Add annotations to provide more context in your alert notifications.';

  if (ruleType === RuleFormType.cloudRecording) {
    return 'Select the Namespace and Group for your recording rule.';
  }
  const docsLink =
    'https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/variables-label-annotation';

  const textToRender =
    ruleType === RuleFormType.grafana
      ? ` ${annotationsText} `
      : ruleType === RuleFormType.cloudAlerting
      ? `Select the Namespace and evaluation group for your alert. ${annotationsText} `
      : '';

  return (
    <Stack gap={0.5}>
      {`${textToRender}`}
      <NeedHelpInfo
        contentText={`Annotations add metadata to provide more information on the alert in your alert notifications. 
          For example, add a Summary annotation to tell you which value caused the alert to fire or which server it happened on.
          Annotations can contain a combination of text and template code.`}
        externalLink={docsLink}
        linkText={`Read about annotations`}
        title="Annotations"
      />
    </Stack>
  );
}

export function DetailsStep() {
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();

  const styles = useStyles2(getStyles);

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const type = watch('type');

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 3 : 4}
      title={type === RuleFormType.cloudRecording ? 'Folder and group' : 'Add annotations'}
      description={getDescription(type, styles)}
    >
      {(ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) &&
        dataSourceName && <GroupAndNamespaceFields rulesSourceName={dataSourceName} />}

      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
    </RuleEditorSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  needHelpText: css`
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.size.sm};
    margin-bottom: ${theme.spacing(0.5)};
    cursor: pointer;
    text-underline-position: under;
  `,

  needHelpTooltip: css`
    max-width: 300px;
    font-size: ${theme.typography.size.sm};
    margin-left: 5px;

    div {
      margin-top: 5px;
      margin-bottom: 5px;
    }
  `,

  tooltipHeader: css`
    color: ${theme.colors.text.primary};
    font-weight: bold;
  `,

  tooltipLink: css`
    color: ${theme.colors.text.link};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `,

  underline: css`
    text-decoration: underline;
  `,
});
