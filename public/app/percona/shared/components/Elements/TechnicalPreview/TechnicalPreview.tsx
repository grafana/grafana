import { Icon, Tooltip, useTheme } from '@grafana/ui';

import { Messages } from './TechnicalPreview.messages';
import { getStyles } from './TechnicalPreview.styles';

export const ReadMoreLink = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <span>
      {Messages.tooltipDescription}{' '}
      <a href="https://per.co.na/pmm-feature-status" target="_blank" rel="noreferrer" className={styles.link}>
        {Messages.linkText}
      </a>
    </span>
  );
};

export const TechnicalPreview = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.labelWrapper}>
      <Tooltip interactive placement="top" theme="info" content={<ReadMoreLink />}>
        <h1>
          <Icon name={'info-circle'} /> {Messages.labelText}
        </h1>
      </Tooltip>
    </div>
  );
};
