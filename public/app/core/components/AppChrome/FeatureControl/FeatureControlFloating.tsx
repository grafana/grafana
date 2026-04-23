import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2, useTheme2 } from '@grafana/ui';

import { FeatureControlFlags } from './FeatureControlFlags';
import { useFeatureControlContext } from './FeatureControlProvider';

export const FeatureControlFloating = () => {
  const { isOpen } = useFeatureControlContext();
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  if (!isOpen) {
    return null;
  }

  return (
    <Portal zIndex={theme.zIndex.modal}>
      <div className={styles.portal}>
        <FeatureControlFlags />
      </div>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  portal: css({
    position: 'fixed',
    bottom: theme.spacing(3),
    right: theme.spacing(3),
  }),
});
