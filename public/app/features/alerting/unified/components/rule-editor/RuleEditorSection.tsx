import { css } from '@emotion/css';
import { isFunction } from 'lodash';
import { ComponentPropsWithoutRef, PropsWithChildren, ReactNode, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FieldSet, IconButton, InlineSwitch, Stack, Text, useStyles2 } from '@grafana/ui';

import { NeedHelpInfo } from './NeedHelpInfo';

export interface RuleEditorSectionProps {
  title: string;
  stepNo: number;
  description?: string;
  helpInfo?: ComponentPropsWithoutRef<typeof NeedHelpInfo>;
  switchMode?: {
    isAdvancedMode: boolean;
    setAdvancedMode: (isAdvanced: boolean) => void;
  };
}

const AlertRuleSelectors = selectors.components.AlertRules;

export const RuleEditorSection = ({
  title,
  stepNo,
  description,
  children,
  helpInfo,
  switchMode,
}: PropsWithChildren<RuleEditorSectionProps>) => {
  const styles = useStyles2(getStyles);

  const titleElement = useMemo(
    () => (
      <div className={styles.section} data-testid={AlertRuleSelectors.step(stepNo.toString())}>
        <Stack direction="column" gap={0.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* title */}
            <Text variant="h4">
              {stepNo}. {title}
            </Text>

            {/* advanced / basic toggle */}
            {switchMode && (
              <Text variant="bodySmall">
                <InlineSwitch
                  id={`step-${stepNo}`}
                  data-testid={AlertRuleSelectors.stepAdvancedModeSwitch(stepNo.toString())}
                  value={switchMode.isAdvancedMode}
                  onChange={(event) => {
                    switchMode.setAdvancedMode(event.currentTarget.checked);
                  }}
                  label="Advanced options"
                  showLabel
                  transparent
                  className={styles.switch}
                />
              </Text>
            )}
          </Stack>

          <Stack direction="row" gap={0.5} alignItems="center">
            {/* description */}
            {description ? (
              <Text color="secondary" variant="bodySmall">
                {description}
              </Text>
            ) : null}
            {/* help button */}
            {helpInfo ? (
              <NeedHelpInfo
                title={helpInfo.linkText}
                contentText={helpInfo.contentText}
                externalLink={helpInfo.externalLink}
                linkText={'Read more on our documentation website'}
              />
            ) : null}
          </Stack>
        </Stack>
      </div>
    ),
    [styles.section, styles.switch, stepNo, title, switchMode, description, helpInfo]
  );

  return (
    <div className={styles.parent}>
      <FieldSet className={styles.fieldSetFix} label={titleElement}>
        {children}
      </FieldSet>
    </div>
  );
};

interface RuleEditorSubSectionProps extends PropsWithChildren {
  title?: ReactNode;
  description?: ReactNode;
  helpInfo?: ComponentPropsWithoutRef<typeof NeedHelpInfo>;
  onToggle?: () => void;
  isCollapsed?: boolean;
  fullWidth?: boolean;
}

export const RuleEditorSubSection = ({
  title,
  description,
  helpInfo,
  children,
  onToggle,
  isCollapsed = false,
  fullWidth = false,
}: RuleEditorSubSectionProps) => {
  const styles = useStyles2(getStyles);
  const showHeader = title || description;

  return (
    <div className={styles.subSection}>
      <Stack direction="column" gap={1} alignItems={fullWidth ? 'stretch' : 'flex-start'}>
        {showHeader && (
          <>
            <Stack direction="column" gap={0}>
              <Stack direction="row" gap={0}>
                {isFunction(onToggle) && (
                  <IconButton
                    name={isCollapsed ? 'angle-right' : 'angle-down'}
                    onClick={onToggle}
                    aria-label="Toggle advanced evaluation behavior options"
                  />
                )}
                {title && (
                  <Text variant="body" color="primary">
                    {title}
                  </Text>
                )}
              </Stack>
              {description && (
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <Text variant="bodySmall" color="secondary">
                    {description}
                  </Text>
                  {helpInfo && <NeedHelpInfo {...helpInfo} />}
                </Stack>
              )}
            </Stack>
          </>
        )}
        {isCollapsed ? null : children}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.secondary,
  }),
  subSection: css({
    borderTop: `solid 1px ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    background: theme.colors.background.primary,
    width: '100%',
  }),
  parent: css({
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  switch: css({
    padding: 0,
    height: 'auto',
  }),
  // fieldset automatically adds a margin to the <Legend> and this messes up our layout
  fieldSetFix: css({
    legend: {
      marginBottom: 0,
    },
  }),
});
