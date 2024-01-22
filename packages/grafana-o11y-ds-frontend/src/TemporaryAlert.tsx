import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { Alert, AlertVariant, useTheme2 } from '@grafana/ui';

export const TemporaryAlert = (props: {
  setVisible: (visible: boolean) => void;
  severity: AlertVariant;
  text: string;
  visible: boolean;
}) => {
  const theme = useTheme2();

  useEffect(() => {
    if (props.visible) {
      setTimeout(() => {
        props.setVisible(false);
      }, 3000);
    }
  }, [props]);

  return (
    <>
      {props.visible && (
        <Alert
          className={css({
            position: 'absolute',
            zIndex: theme.zIndex.portal,
            top: 0,
            right: 10,
          })}
          title={props.text}
          severity={props.severity}
          elevated={true}
        />
      )}
    </>
  );
};
