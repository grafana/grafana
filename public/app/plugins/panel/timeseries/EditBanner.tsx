import { DismissableFeatureInfoBox } from '@grafana/ui';
import { css } from 'emotion';
import React from 'react';

export const EditBanner: React.FC = ({}) => {
  return (
    <DismissableFeatureInfoBox
      title="New time series panel"
      className={css`
        margin: 8px;
      `}
      persistenceId="timeseries-parity-azx"
      url={'https://github.com/grafana/grafana/issues/30564'}
      urlTitle="See open github issue"
    >
      <p>
        The new time series panel is now the default panel in grafana. For most things, this is will be the best choice.
        However a few features exist in the graph panel that are not yet implemented in this panel. Speciffically:
        <ul>
          <li>Annotaiton editor</li>
          <li>Alert threshold visualization</li>
          <li>Global tooltip/crosshairs</li>
          <li>Region selection</li>
        </ul>
      </p>
    </DismissableFeatureInfoBox>
  );
};
