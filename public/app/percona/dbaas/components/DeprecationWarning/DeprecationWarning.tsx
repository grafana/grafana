import React, { FC } from 'react';

import { Alert } from '@grafana/ui';

import { EVEREST_LINK, MIGRATION_GUIDE_LINK } from './DeprecationWarning.constants';
import { Messages } from './DeprecationWarning.messages';

const DbaasDeprecationWarning: FC<React.PropsWithChildren<unknown>> = () => (
  <div>
    <Alert title={Messages.title} severity="warning">
      {Messages.warning}
      <a target="_blank" rel="noopener noreferrer" href={EVEREST_LINK}>
        {Messages.everest}
      </a>
      {Messages.warningCont}
      <a target="_blank" rel="noopener noreferrer" href={MIGRATION_GUIDE_LINK}>
        {Messages.guide}
      </a>
      {Messages.dot}
    </Alert>
  </div>
);

export default DbaasDeprecationWarning;
