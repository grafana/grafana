import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { HoverCard } from '../HoverCard';

import AnnotationsField from './AnnotationsField';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';

function getDescription(ruleType: RuleFormType | undefined, styles: { [key: string]: string }) {
  const annotationsText = 'Add annotations to provide more context in your alert notifications.';

  if (ruleType === RuleFormType.cloudRecording) {
    return 'Select the Namespace and Group for your recording rule.';
  }
  const docsLink =
    'https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/variables-label-annotation';

  const HelpContent = () => (
    <div className={styles.needHelpTooltip}>
      <div className={styles.tooltipHeader}>
        <Icon name="question-circle" /> Annotations
      </div>
      <div>
        Annotations add metadata to provide more information on the alert in your alert notifications. For example, add
        a Summary annotation to tell you which value caused the alert to fire or which server it happened on.
      </div>
      <div>Annotations can contain a combination of text and template code.</div>
      <div>
        <a href={docsLink} target="_blank" rel="noreferrer" className={styles.tooltipLink}>
          Read about annotations <Icon name="external-link-alt" size="sm" tabIndex={0} />
        </a>
      </div>
    </div>
  );
  const LinkToDocs = () => (
    <HoverCard content={<HelpContent />} placement={'bottom-start'}>
      <span className={styles.needHelpText}>
        <Icon name="info-circle" size="sm" tabIndex={0} /> <span className={styles.underline}>Need help?</span>
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
