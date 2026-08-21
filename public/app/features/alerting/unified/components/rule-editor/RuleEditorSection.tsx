import { css, cx } from '@emotion/css';
import * as React from 'react';
import { type ReactElement } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { FieldSet, InlineSwitch, Stack, Text, useStyles2 } from '@grafana/ui';
import { AccentBoxBadge } from 'app/core/components/AccentBoxBadge/AccentBoxBadge';

export interface RuleEditorSectionProps {
  title: string;
  stepNo: number;
  description?: string | ReactElement;
  fullWidth?: boolean;
  switchMode?: {
    isAdvancedMode: boolean;
    setAdvancedMode: (isAdvanced: boolean) => void;
  };
}

export const RuleEditorSection = ({
  title,
  stepNo,
  children,
  fullWidth = false,
  description,
  switchMode,
}: React.PropsWithChildren<RuleEditorSectionProps>) => {
  const styles = useStyles2(getStyles);

  const AlertRuleSelectors = selectors.components.AlertRules;
  return (
    <div className={styles.parent} data-testid={AlertRuleSelectors.step(stepNo.toString())}>
      <FieldSet
        className={cx(fullWidth && styles.fullWidth)}
        label={
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="flex-start" gap={1.5}>
              <AccentBoxBadge>{stepNo}</AccentBoxBadge>
              <Stack direction="column" gap={0.5}>
                <Text variant="h4">{title}</Text>
                {description}
              </Stack>
            </Stack>
            {switchMode && (
              <Text variant="bodySmall">
                <InlineSwitch
                  data-testid={AlertRuleSelectors.stepAdvancedModeSwitch(stepNo.toString())}
                  value={switchMode.isAdvancedMode}
                  onChange={(event) => {
                    switchMode.setAdvancedMode(event.currentTarget.checked);
                  }}
                  label={t('alerting.rule-editor-section.label-advanced-options', 'Advanced options')}
                  showLabel
                  transparent
                  className={styles.reverse}
                />
              </Text>
            )}
          </Stack>
        }
      >
        <div className={styles.sectionContent}>{children}</div>
      </FieldSet>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  parent: css({
    display: 'flex',
    flexDirection: 'row',
  }),
  fullWidth: css({
    width: '100%',
    flexGrow: 1,
  }),
  reverse: css({
    flexDirection: 'row-reverse',
    gap: theme.spacing(1),
  }),
  sectionContent: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(3),
    marginLeft: theme.spacing(6),
  }),
});
