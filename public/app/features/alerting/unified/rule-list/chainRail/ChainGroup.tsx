import { type ReactNode } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getChainRailStyles } from './styles';

interface ChainGroupProps {
  children: ReactNode;
  'data-testid'?: string;
}

export function ChainGroup({ children, 'data-testid': testId }: ChainGroupProps) {
  const styles = useStyles2(getChainRailStyles);
  return (
    <div role="group" className={styles.chainGroup} data-testid={testId}>
      {children}
    </div>
  );
}
