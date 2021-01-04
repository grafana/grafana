import React, { useState } from 'react';
import { Button, Input, Modal, NewTable } from '@grafana/ui';

interface Dashboard {
  name: string;
  lastEdited: string;
  author: string;
}

interface Props {
  affectedDashboards: Dashboard[];
}

export const ChooseDashModal = ({ affectedDashboards }: Props) => {
  const [selectedDash, setSelectedDash] = useState<undefined | string>(undefined);

  return (
    <Modal title="Choose a dashboard to view this panel in">
      <div>
        <div>
          This panel is being used in <strong>{affectedDashboards.length} dashboards</strong>. Please choose which
          dashboard to view this panel in:
        </div>
        <Input placeholder="Search possible dashboards" />
        <NewTable
          headers={[
            {
              name: 'Radios',
              // eslint-disable-next-line react/display-name
              render: (_x: any, _y: any, row: any) => (
                <input type="radio" name="test" value={row[1]} onChange={() => setSelectedDash(row[1])} />
              ),
              sortable: false,
            },
            { name: 'Dashboard name' },
            { name: 'Last edited' },
            { name: 'by', render: (s: string) => s.toUpperCase() },
          ]}
          rows={[
            [{}, 'Prometheus Alerts', '2020-11-04', 'LaurenIpsum'],
            [{}, 'Envoy Overview', '2020-11-03', 'jessover9000'],
            [{}, 'Dashboard title', '2020-10-28', 'longestusernameinhistory'],
            [{}, 'A longer dashboard title to test this out', '2020-10-28', 'myfavouriteuser'],
          ]}
        />
        <div>
          <Button>View Panel in &quot;{selectedDash}&quot;</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};
