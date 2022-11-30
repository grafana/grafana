import { css } from '@emotion/css';
import { PanelData } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

interface Props {
  data?: PanelData;
  errorMessage?: string;
}

export function PanelHeaderState(props: Props) {
  // TODO Fancy logic to determine if the panel is in an error state or if has notices to show
  const styles = useStyles2(getStyles);
  const infoMode = true;

  return (
    <div className={styles.container}>
      {infoMode && (
        //this should be reusable depending of the type of state (error, warning, info)
        <IconButton className={styles.buttonStyles} name="info-circle" variant="secondary" tooltip="default message" />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      position: 'absolute',
      width: '100%',
      justifyContent: 'center',
    }),
    buttonStyles: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: '8px',
      gap: '8px',
      width: '32px',
      height: '32px',
      borderRadius: 0,
      background: '#3D71D9;',
    }),
  };
};
