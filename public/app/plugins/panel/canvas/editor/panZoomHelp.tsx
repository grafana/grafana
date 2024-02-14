import { css } from '@emotion/css';
import React from 'react';

import { StandardEditorProps, GrafanaTheme2 } from '@grafana/data';
import { Alert, HorizontalGroup, Icon, VerticalGroup, useStyles2 } from '@grafana/ui';

const helpUrl = 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/canvas/';

export const PanZoomHelp = ({}: StandardEditorProps<string, unknown, unknown, unknown>) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <HorizontalGroup className={styles.hGroup}>
        <Alert
          title="Pan and zoom controls"
          severity="info"
          buttonContent={<Icon name="question-circle" size="xl" />}
          className={styles.alert}
          onRemove={() => {
            const newWindow = window.open(helpUrl, '_blank', 'noopener,noreferrer');
            if (newWindow) {
              newWindow.opener = null;
            }
          }}
        >
          <VerticalGroup>
            <ul>
              <li>
                Pan:
                <ul>
                  <li>Middle mouse</li>
                  <li>CTRL + right mouse</li>
                </ul>
              </li>
              <li>Zoom: Scroll wheel</li>
              <li>Reset: Double click</li>
            </ul>
          </VerticalGroup>
        </Alert>
      </HorizontalGroup>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  alert: css({
    '& div': { padding: '4px', alignItems: 'start' },
    marginBottom: '0px',
    marginTop: '5px',
    padding: '2px',
    'ul > li': { marginLeft: '10px' },
  }),
  hGroup: css({
    '& div': { width: '100%' },
  }),
});
