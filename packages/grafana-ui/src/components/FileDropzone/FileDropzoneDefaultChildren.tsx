import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

export function FileDropzoneDefaultChildren({ primaryText = 'Drop file here or click to upload', secondaryText = '' }) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={cx(styles.defaultDropZone)} data-testid="file-drop-zone-default-children">
      <Icon className={cx(styles.icon)} name="upload" size="xl" />
      <h6 className={cx(styles.primaryText)}>{primaryText}</h6>
      <small className={styles.small}>{secondaryText}</small>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    defaultDropZone: css({
      textAlign: 'center',
    }),
    icon: css({
      marginBottom: theme.spacing(1),
    }),
    primaryText: css({
      marginBottom: theme.spacing(1),
    }),
    small: css({
      color: theme.colors.text.secondary,
    }),
  };
}
