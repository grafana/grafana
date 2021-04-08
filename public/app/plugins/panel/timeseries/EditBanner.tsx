import { FeatureInfoBox } from '@grafana/ui';
import { css } from '@emotion/css';
import React from 'react';

export const EditBanner: React.FC = ({}) => {
  return (
    <FeatureInfoBox
      title="Time series panel"
      className={css`
        margin: 8px;
      `}
      url={'https://github.com/grafana/grafana/issues/30564'}
      urlTitle="See open github issue"
    >
      <p>
        The new time series panel is now the default panel in grafana. In general, this is will be the best choice;
        However, a few features exist in the graph panel that are not yet implemented in this panel. Specifically:
        <ul
          className={css`
            margin-left: 1.5em;
          `}
        >
          <li>Alert threshold visualization</li>
          <li>Annotation editor</li>
          <li>Global tooltip/crosshairs</li>
          <li>Region selection</li>
        </ul>
      </p>
    </FeatureInfoBox>
  );
};
