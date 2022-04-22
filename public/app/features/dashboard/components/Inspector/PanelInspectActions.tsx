import React, { ComponentType } from 'react';

import { PanelData } from '@grafana/data';

import { PanelModel } from '../../state';

export interface PanelInspectActionProps {
  panel: PanelModel;
  data?: PanelData;
}

export interface PanelInspectAction {
  title: string;
  description: string;

  component: ComponentType<PanelInspectActionProps>;
}

export interface PanelInspectActionSupplier {
  getActions: (panel: PanelModel) => PanelInspectAction[] | null;
}

// const dummySupplier: PanelInspectActionSupplier = {
//   getActions: (panel: PanelModel) => {
//     return [
//       {
//         title: 'Do something',
//         description: 'that thingy',
//         // eslint-disable-next-line react/display-name
//         component: ({ panel }) => {
//           return (
//             <div>
//               DO THING ONE. Panel: <pre>{JSON.stringify(panel.targets)}</pre>
//             </div>
//           );
//         },
//       },
//       {
//         title: 'Do something else',
//         description: 'another thing',
//         // eslint-disable-next-line react/display-name
//         component: ({ panel }) => {
//           return (
//             <div>
//               DO THING TWO. Panel: <pre>{JSON.stringify(panel.targets)}</pre>
//             </div>
//           );
//         },
//       },
//     ];
//   },
// };

// In Grafana 8.1, this can be improved and moved to `@grafana/runtime`
// NOTE: This is an internal/experimental API/hack and will change!
// (window as any).grafanaPanelInspectActionSupplier = dummySupplier;

interface InspectActionsTabProps {
  panel: PanelModel;
  data?: PanelData;
}

export const InspectActionsTab: React.FC<InspectActionsTabProps> = ({ panel, data }) => {
  const supplier = (window as any).grafanaPanelInspectActionSupplier as PanelInspectActionSupplier;
  if (!supplier) {
    return <div>Missing actions</div>;
  }

  const actions = supplier.getActions(panel);
  if (!actions?.length) {
    return <div>No actions avaliable</div>;
  }

  return (
    <div>
      {actions.map((a, idx) => (
        <div key={idx}>
          <h2>{a.title}</h2>
          <span>{a.description}</span>
          <a.component panel={panel} data={data} />
        </div>
      ))}
    </div>
  );
};
