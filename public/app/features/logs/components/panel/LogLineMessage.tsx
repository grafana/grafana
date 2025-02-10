import { CSSProperties, ReactNode } from 'react';

import { useTheme2 } from '@grafana/ui';

import { getStyles } from './LogLine';

interface Props {
  children: ReactNode;
  style: CSSProperties;
}

export const LogLineMessage = ({ children, style }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div style={style} className={`${styles.logLine} ${styles.logLineMessage}`}>
      {children}
    </div>
  );
};
