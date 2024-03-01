import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { EmbeddedDashboard } from '@grafana/runtime';
import { Button, Drawer, Stack, VerticalGroup } from '@grafana/ui';

import { DashboardGrid } from '../dashboard/dashgrid/DashboardGrid';
import { dashboardLoaderSrv } from '../dashboard/services/DashboardLoaderSrv';
import { getTimeSrv, TimeSrv } from '../dashboard/services/TimeSrv';
import { DashboardModel } from '../dashboard/state';
import { createDashboardQueryRunner } from '../query/state/DashboardQueryRunner/DashboardQueryRunner';

// export function EntityDrawer(props: Props) {
//   const dashboard = useAsync(async () => {
//     const dashboardDTO = await dashboardLoaderSrv.loadDashboard('db', '', 'dde9o9plp1c00c');
//
//     if (!dashboardDTO) {
//       throw new Error('Dashboard not found');
//     }
//
//     const dashboard = new DashboardModel(dashboardDTO.dashboard, dashboardDTO.meta);
//
//     const timeSrv: TimeSrv = getTimeSrv();
//     timeSrv.init(dashboard);
//     const runner = createDashboardQueryRunner({ dashboard, timeSrv });
//     runner.run({ dashboard, range: timeSrv.timeRange() });
//     return dashboard;
//   }, []);
//
//   const body: React.ReactNode = !dashboard.value ? (
//     'Loading...'
//   ) : (
//     <DashboardGrid dashboard={dashboard.value} isEditable={false} viewPanel={null} editPanel={null} />
//   );
//
//   return (
//     <Drawer closeOnMaskClick={true} title={props.title} onClose={props.onClose}>
//       {body}
//     </Drawer>
//   );
// }

type Entity = {
  type: string;
  id: string;
  dashboardUid: string;
  parents?: string[];
  children?: string[];
};

const entitiesMap: Record<string, Entity> = {
  'service:app': {
    type: 'service',
    id: 'app',
    dashboardUid: 'dde9o9plp1c00c',
    parents: ['namespace:tns'],
    children: ['container:devenv-app-1'],
  },

  'namespace:tns': {
    type: 'namespace',
    id: 'tns',
    dashboardUid: 'bdecitbzna96od',
    children: ['service:app'],
  },

  'container:devenv-app-1': {
    type: 'container',
    id: 'devenv-app-1',
    dashboardUid: 'bdecitbzna96od',
    parents: ['service:app'],
  },
};

type Props = {
  entity: 'service:app' | 'namespace:tns';
  title: string;
  onClose: () => void;
};

export function EntityDrawer(props: Props) {
  const entity = entitiesMap[props.entity];

  // Stack to allow moving between entities while keeping a breadcrumbs of what we looked at before
  const [navStack, setNavStack] = useState([entity]);

  useEffect(() => {
    // if entity changes from outside make sure we reset the nav stack, otherwise we will manage it from inside
    setNavStack([entity]);
  }, [entity]);

  const currentEntity = navStack[navStack.length - 1];

  return (
    <Drawer closeOnMaskClick={true} title={props.title} onClose={props.onClose}>
      <Stack direction={'column'} gap={1}>
        <EntityMap entity={currentEntity} onEntityChange={(id) => setNavStack([...navStack, entitiesMap[id]])} />
        <EmbeddedDashboard uid={currentEntity.dashboardUid} />
      </Stack>
    </Drawer>
  );
}

type EntityMapProps = {
  entity: Entity;
  onEntityChange: (entityId: string) => void;
};

function EntityMap(props: EntityMapProps) {
  // TODO ideally should be Asserts entity map visualization but for now test it like this.
  return (
    <div>
      {props.entity.parents?.map((id) => <EntityButton entityId={id} onEntityChange={props.onEntityChange} />)}
      <span>
        {props.entity.type}: {props.entity.id}
      </span>
      {props.entity.children?.map((id) => <EntityButton entityId={id} onEntityChange={props.onEntityChange} />)}
    </div>
  );
}

function EntityButton(props: { entityId: string; onEntityChange: (id: string) => void }) {
  return (
    <Button
      onClick={() => {
        props.onEntityChange(props.entityId);
      }}
    >
      {entitiesMap[props.entityId].type}: {entitiesMap[props.entityId].id}
    </Button>
  );
}
