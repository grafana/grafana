import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useTheme2 } from '@grafana/ui';

export enum AlertSeverity {
  Error = 'error',
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
}

enum AppNotificationTimeout {
  Error = 7000,
  Info = 3000,
  Success = 3000,
  Warning = 5000,
}

const getStyle = (theme: GrafanaTheme2) => {
  return css({
    position: 'absolute',
    zIndex: theme.zIndex.portal,
    top: 0,
    right: 10,
  });
};

export const timeoutMap = {
  [AlertSeverity.Error]: AppNotificationTimeout.Error,
  [AlertSeverity.Info]: AppNotificationTimeout.Info,
  [AlertSeverity.Success]: AppNotificationTimeout.Success,
  [AlertSeverity.Warning]: AppNotificationTimeout.Warning,
};

export const TemporaryAlert = (props: { severity: AlertSeverity; text: string }) => {
  const style = getStyle(useTheme2());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, timeoutMap[props.severity]);

      return () => {
        clearTimeout(timer);
      };
    }
    return () => {};
  }, [props.severity, visible]);

  useEffect(() => {
    if (props.text !== '') {
      setVisible(true);
    }
  }, [props.text]);

  return <>{visible && <Alert className={style} elevated={true} title={props.text} severity={props.severity} />}</>;
};
