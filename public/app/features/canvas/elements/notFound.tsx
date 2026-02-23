import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { CanvasElementItem, CanvasElementProps } from '../element';

const NotFoundDisplay = memo(({ config }: CanvasElementProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <Trans
        i18nKey="canvas.not-found-display.not-found"
        components={{ config: <pre>{JSON.stringify(config, null, 2)}</pre> }}
      >
        <span className={styles.heading}>Not found: </span>
        {'<config />'}
      </Trans>
    </div>
  );
});

NotFoundDisplay.displayName = 'NotFoundDisplay';

export const notFoundItem: CanvasElementItem = {
  id: 'not-found',
  name: 'Not found',
  description: 'Display when element type is not found in the registry',

  display: NotFoundDisplay,

  defaultSize: {
    width: 100,
    height: 100,
  },

  getNewOptions: () => ({
    config: {},
  }),
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ background: theme.colors.background.canvas }),
  heading: css({ ...theme.typography.h3 }),
});
