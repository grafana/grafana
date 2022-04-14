import React from 'react';
import { DataModel } from 'app/percona/backup/Backup.types';
import { RestoreHistoryDetails } from './RestoreHistoryDetails';
import { render, screen } from '@testing-library/react';

const FINISHED_DATE = 1615912580244;
describe('RestoreHistoryDetails', () => {
  it('should render', () => {
    render(<RestoreHistoryDetails name="restore one" finished={FINISHED_DATE} dataModel={DataModel.PHYSICAL} />);
    expect(screen.getByTestId('restore-details-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-name')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-finished')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-data-model')).toBeInTheDocument();
    expect(screen.getByTestId('restore-details-date')).toBeInTheDocument();
  });

  it('should hide "finished at" when null', () => {
    render(<RestoreHistoryDetails name="restore one" finished={null} dataModel={DataModel.PHYSICAL} />);
    expect(screen.queryByTestId('restore-details-finished')).not.toBeInTheDocument();
  });
});
