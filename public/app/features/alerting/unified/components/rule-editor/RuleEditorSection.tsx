import { css, cx } from '@emotion/css';
import * as React from 'react';
import { ComponentPropsWithoutRef, PropsWithChildren, ReactElement, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FieldSet, InlineSwitch, Stack, Text, useStyles2 } from '@grafana/ui';

import { NeedHelpInfo } from './NeedHelpInfo';

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
  return (
    <div className={styles.parent}>
      <FieldSet
        className={cx(fullWidth && styles.fullWidth)}
        label={
          <Stack direction="column" gap={0.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              {/* title */}
              <Text variant="h3">
                {stepNo}. {title}
              </Text>

              {/* advanced / basic toggle */}
              {switchMode && (
                <Text variant="bodySmall">
                  <InlineSwitch
                    id={`advanced-switch-${stepNo}`}
                    data-testid={
                      switchMode.isAdvancedMode
                        ? `advanced-switch-${stepNo}-advanced`
                        : `advanced-switch-${stepNo}-basic`
                    }
                    value={switchMode.isAdvancedMode}
                    onChange={(event) => {
                      switchMode.setAdvancedMode(event.currentTarget.checked);
                    }}
                    label="Advanced options"
                    showLabel
                    transparent
                    className={styles.reverse}
                  />
                </Text>
              )}
            </Stack>
            {/* description */}
            {description ? description : null}
          </Stack>
        }
      >
        <Stack direction="column" gap={2} alignItems="flex-start">
          {children}
        </Stack>
      </FieldSet>
    </div>
  );
};

interface RuleEditorSubSectionProps extends PropsWithChildren {
  title?: ReactNode;
  description?: ReactNode;
  helpInfo?: ComponentPropsWithoutRef<typeof NeedHelpInfo>;
}

export const RuleEditorSubSection = ({ title, description, helpInfo, children }: RuleEditorSubSectionProps) => {
  return (
    <Stack direction="column" alignItems="flex-start">
      <Stack direction="column" alignItems="flex-start" gap={0}>
        {title && <Text variant="h5">{title}</Text>}
        {description && (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Text variant="bodySmall" color="secondary">
              {description}
            </Text>
            {helpInfo && <NeedHelpInfo {...helpInfo} />}
          </Stack>
        )}
      </Stack>
      {children}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  parent: css({
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  }),
  fullWidth: css({
    width: '100%',
  }),
  reverse: css({
    flexDirection: 'row-reverse',
    gap: theme.spacing(1),
  }),
});
