import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SettingsBarHeader, Props as SettingsBarHeaderProps } from './SettingsBarHeader';

export interface Props extends Pick<SettingsBarHeaderProps, 'headerElement' | 'title'> {
  children: React.ReactNode;
}

export function SettingsBar({ children, title, headerElement, ...rest }: Props) {
  const styles = useStyles2(getStyles);
  const [isContentVisible, setIsContentVisible] = useState(false);

  function onRowToggle() {
    setIsContentVisible((prevState) => !prevState);
  }

  return (
    <>
      <SettingsBarHeader
        onRowToggle={onRowToggle}
        isContentVisible={isContentVisible}
        title={title}
        headerElement={headerElement}
        {...rest}
      />
      {isContentVisible && <div className={styles.content}>{children}</div>}
    </>
  );
}

SettingsBar.displayName = 'SettingsBar';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css({
      marginTop: theme.spacing(1),
      marginLeft: theme.spacing(4),
    }),
  };
};
