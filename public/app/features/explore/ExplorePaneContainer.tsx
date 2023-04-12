import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';

import { EventBusSrv, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { ExploreId } from 'app/types/explore';

import Explore from './Explore';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    explore: css`
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      overflow: hidden;
      min-width: 600px;
      & + & {
        border-left: 1px dotted ${theme.colors.border.medium};
      }
    `,
  };
};

interface Props {
  exploreId: ExploreId;
}

export function ExplorePaneContainer({ exploreId }: Props) {
  const styles = useStyles2(getStyles);
  const eventBus = useRef(new EventBusSrv());
  const ref = useRef(null);

  useEffect(() => {
    const bus = eventBus.current;
    return () => bus.removeAllListeners();
  }, []);

  return (
    <div className={styles.explore} ref={ref} data-testid={selectors.pages.Explore.General.container}>
      <Explore exploreId={exploreId} eventBus={eventBus.current} />
    </div>
  );
}
