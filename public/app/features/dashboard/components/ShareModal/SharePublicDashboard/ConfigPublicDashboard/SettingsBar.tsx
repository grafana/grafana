import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SettingsBarHeader } from './SettingsBarHeader';

export interface Props {
  title: string;
  headerElement?: React.ReactNode | ((props: { className?: string }) => React.ReactNode);
  children: React.ReactNode;
}

export function SettingsBar({ children, title, headerElement }: Props) {
  const styles = useStyles2(getStyles);
  const [isContentVisible, setIsContentVisible] = useState(false);

  const onRowToggle = useCallback(() => {
    setIsContentVisible(!isContentVisible);
  }, [isContentVisible, setIsContentVisible]);

  return (
    <>
      <SettingsBarHeader
        onRowToggle={onRowToggle}
        isContentVisible={isContentVisible}
        title={title}
        headerElement={headerElement}
      />
      {isContentVisible && <div className={styles.content}>{children}</div>}
    </>
  );
}

SettingsBar.displayName = 'SettingsBar';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css({
      marginTop: theme.spacing(0.5),
      marginLeft: theme.spacing(3),
    }),
  };
};
