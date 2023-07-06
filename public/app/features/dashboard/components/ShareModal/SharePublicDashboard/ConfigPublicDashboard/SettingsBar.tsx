import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ReactUtils, useStyles2 } from '@grafana/ui';

import { SettingsBarHeader } from './SettingsBarHeader';

export interface SettingsBarProps {
  title?: string;
  headerElement?: SettingsBarRenderProp;
  onOpen?: () => void;
  onClose?: () => void;
  isOpen?: boolean;
  children: React.ReactNode;
}

export type SettingsBarRenderProp = ((props: SettingsBarRenderProps) => React.ReactNode) | React.ReactNode;

export interface SettingsBarRenderProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function SettingsBar({ children, title, headerElement }: SettingsBarProps) {
  const [isContentVisible, setIsContentVisible] = useState(false);
  const styles = useStyles2(getSettingsBarStyles);
  const onRowToggle = useCallback(() => {
    setIsContentVisible(!isContentVisible);
  }, [isContentVisible, setIsContentVisible]);

  const renderPropArgs: SettingsBarRenderProps = {
    isOpen: isContentVisible,
    onOpen: () => {
      setIsContentVisible(true);
    },
    onClose: () => {
      setIsContentVisible(false);
    },
  };

  const headerElementRendered = headerElement && ReactUtils.renderOrCallToRender(headerElement, renderPropArgs);

  return (
    <>
      <SettingsBarHeader
        headerElement={headerElementRendered}
        isContentVisible={isContentVisible}
        onRowToggle={onRowToggle}
        title={title}
      />
      {isContentVisible && <div className={styles.content}>{children}</div>}
    </>
  );
}

SettingsBar.displayName = 'SettingsBar';

const getSettingsBarStyles = (theme: GrafanaTheme2) => {
  return {
    content: css({
      marginTop: theme.spacing(0.5),
      marginLeft: theme.spacing(3),
    }),
  };
};
