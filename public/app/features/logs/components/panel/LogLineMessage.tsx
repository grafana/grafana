import { CSSProperties, ReactNode } from 'react';

import { useTheme2 } from '@grafana/ui';

import { getStyles } from './LogLine';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  style: CSSProperties;
}

export const LogLineMessage = ({ children, onClick, style }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div style={style} className={`${styles.logLine} ${styles.logLineMessage}`}>
      {onClick ? (
        <button className={styles.loadMoreButton} onClick={onClick}>
          {children}
        </button>
      ) : (
        children
      )}
    </div>
  );
};
