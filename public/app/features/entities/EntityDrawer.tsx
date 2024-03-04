import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { EmbeddedDashboard } from '@grafana/runtime';
import { Button, Divider, Drawer, FilterPill, Stack, VerticalGroup } from '@grafana/ui';
import { IconButton } from '@grafana/ui/';

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
  'namespace:tns': {
    type: 'namespace',
    id: 'tns',
    dashboardUid: 'bdecitbzna96od',
    children: ['service:app', 'service:db'],
  },

  'service:app': {
    type: 'service',
    id: 'app',
    dashboardUid: 'dde9o9plp1c00c',
    parents: ['namespace:tns'],
    children: ['container:devenv-app-1', 'container:devenv-app-2'],
  },

  'service:db': {
    type: 'service',
    id: 'db',
    dashboardUid: 'dde9o9plp1c00c',
    parents: ['namespace:tns'],
    children: ['container:devenv-db-1'],
  },

  'container:devenv-app-1': {
    type: 'container',
    id: 'devenv-app-1',
    dashboardUid: 'bdecitbzna96od',
    parents: ['service:app'],
  },

  'container:devenv-app-2': {
    type: 'container',
    id: 'devenv-app-2',
    dashboardUid: 'bdecitbzna96od',
    parents: ['service:app'],
  },

  'container:devenv-db-1': {
    type: 'container',
    id: 'devenv-db-1',
    dashboardUid: 'bdecitbzna96od',
    parents: ['service:db'],
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
    <Drawer closeOnMaskClick={true} onClose={props.onClose}>
      <Stack direction={'column'} gap={1}>
        <Stack direction={'row'} justifyContent={'space-between'} alignItems={'center'}>
          <Breadcrumbs stack={navStack} />
          <IconButton name={'times'} onClick={props.onClose} aria-label={'close'} size={'xl'} />
        </Stack>
        <Divider />
        <EntityMap entity={currentEntity} onEntityChange={(id) => setNavStack([...navStack, entitiesMap[id]])} />
        <Divider />
        <div style={{ flex: '1', overflow: 'scroll' }}>
          <EmbeddedDashboard
            uid={currentEntity.dashboardUid}
            // This should rather be synchrnoized with the current time range of the parent view
            // but for testing this makes sense as default
            initialState={'?from=now-15m&to=now'}
          />
        </div>
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
    <Stack direction={'row'} alignItems={'center'}>
      {props.entity.parents?.length && (
        <>
          <Stack direction={'column'}>
            {props.entity.parents?.map((id) => (
              <EntityButton key={'parent' + id} entityId={id} onEntityChange={props.onEntityChange} />
            ))}
          </Stack>
          <span> &gt; </span>
        </>
      )}

      <FilterPill label={`${props.entity.type}: ${props.entity.id}`} selected={true} onClick={() => {}} />

      {props.entity.children?.length && (
        <>
          <span> &gt; </span>
          <Stack direction={'column'}>
            {props.entity.children?.map((id) => (
              <EntityButton key={'child' + id} entityId={id} onEntityChange={props.onEntityChange} />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

function Breadcrumbs(props: { stack: Entity[] }) {
  return (
    <Stack direction={'row'} alignItems={'center'}>
      {props.stack.map((entity, index) => (
        <>
          <span key={entity.id}>{entity.id}</span>
          {index < props.stack.length - 1 && <span>&gt;</span>}
        </>
      ))}
    </Stack>
  );
}

function EntityButton(props: { entityId: string; onEntityChange: (id: string) => void }) {
  return (
    <FilterPill
      label={`${entitiesMap[props.entityId].type}: ${entitiesMap[props.entityId].id}`}
      onClick={() => {
        props.onEntityChange(props.entityId);
      }}
      selected={false}
    />
  );
}
