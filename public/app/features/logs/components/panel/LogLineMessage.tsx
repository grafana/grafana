import { CSSProperties, ReactNode } from 'react';

import { LogLineStyles } from './LogLine';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  style: CSSProperties;
  styles: LogLineStyles;
}

export const LogLineMessage = ({ children, onClick, style, styles }: Props) => {
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
