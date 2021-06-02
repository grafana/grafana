import React, { FC } from 'react';
import { Switch, useTheme } from '@grafana/ui';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { SwitchRowProps } from './SwitchRow.types';
import { getStyles } from './Advanced.styles';

export const SwitchRow: FC<SwitchRowProps> = ({
  label,
  tooltip = '',
  tooltipLinkText = '',
  link = '',
  disabled,
  className,
  dataQa,
  input,
}) => {
  const theme = useTheme();
  const settingsStyles = getSettingsStyles(theme);
  const styles = getStyles(theme);

  return (
    <div className={styles.advancedRow} data-qa={dataQa}>
      <div className={styles.advancedCol}>
        <div className={settingsStyles.labelWrapper}>
          <span>{label}</span>
          <LinkTooltip tooltipText={tooltip} link={link} linkText={tooltipLinkText} icon="info-circle" />
        </div>
      </div>
      <div className={className}>
        <Switch {...input} value={input.checked} disabled={disabled} />
      </div>
    </div>
  );
};
