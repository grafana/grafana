import React, { FC, useState } from 'react';

import { Collapse, useStyles } from '@grafana/ui';
import { Label } from 'app/percona/shared/components/Form/Label';

import { Messages } from '../TemplateForm.messages';

import { getStyles } from './AdvancedRuleSection.styles';
import { AdvancedRuleSectionProps } from './AdvancedRuleSection.types';

export const AdvancedRuleSection: FC<AdvancedRuleSectionProps> = ({ expression, summary }) => {
  const styles = useStyles(getStyles);
  const [isAdvancedSectionOpen, setIsAdvancedSectionOpen] = useState(false);

  return (
    <div data-testid="alert-rule-advanced-section">
      <Collapse
        label={Messages.advanced}
        collapsible
        isOpen={isAdvancedSectionOpen}
        onToggle={() => setIsAdvancedSectionOpen((open) => !open)}
      >
        <div data-testid="template-expression" className={styles.templateParsedField}>
          <Label label={Messages.templateExpression} />
          <pre>{expression}</pre>
        </div>
        {summary && (
          <div data-testid="template-alert" className={styles.templateParsedField}>
            <Label label={Messages.ruleAlert} />
            <pre>{summary}</pre>
          </div>
        )}
      </Collapse>
    </div>
  );
};
