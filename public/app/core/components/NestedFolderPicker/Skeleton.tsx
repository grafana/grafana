import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import type { GrafanaTheme2 } from '@grafana/data';
import { getInputStyles, useStyles2 } from '@grafana/ui';

// This component is used as a fallback for codesplitting, so aim to keep
// the bundle size of it as small as possible :)
export function FolderPickerSkeleton() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        <button type="button" className={styles.fakeInput} aria-disabled>
          <Skeleton width={100} />
        </button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

  return {
    wrapper: baseStyles.wrapper,
    inputWrapper: baseStyles.inputWrapper,
    fakeInput: css([
      baseStyles.input,
      {
        textAlign: 'left',
      },
    ]),
  };
};
