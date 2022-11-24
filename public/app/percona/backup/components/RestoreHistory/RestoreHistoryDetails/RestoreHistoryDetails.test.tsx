import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataModel } from 'app/percona/backup/Backup.types';

import { RestoreHistoryDetails } from './RestoreHistoryDetails';

const PITR_TS = 1615912580244;
describe('RestoreHistoryDetails', () => {
  it('should render', () => {
    render(<RestoreHistoryDetails name="restore one" pitrTimestamp={PITR_TS} dataModel={DataModel.PHYSICAL} />);
    expect(screen.getByTestId('restore-details-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-name')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-data-model')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-pitr')).toBeInTheDocument();
  });

  it('should hide "PITR timestamp" when null', () => {
    render(<RestoreHistoryDetails name="restore one" dataModel={DataModel.PHYSICAL} />);
    expect(screen.queryByTestId('restore-details-pitr')).not.toBeInTheDocument();
  });
});
