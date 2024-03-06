import { LayoutConfig } from '@antv/g6';
import React, { useCallback, useEffect, useState } from 'react';

import { EmbeddedDashboard } from '@grafana/runtime';
import { Drawer, FilterPill, Stack, Button } from '@grafana/ui';
import { IconButton } from '@grafana/ui/';

import GraphinGraph from './GraphinGraph/GraphinGraph.component';
import { GraphCustomData, GraphCustomEdge, GraphCustomNode } from './asserts-types';

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
    dashboardUid: 'adeuqybdrjugwc',
    parents: ['service:app'],
  },

  'container:devenv-app-2': {
    type: 'container',
    id: 'devenv-app-2',
    dashboardUid: 'adeuqybdrjugwc',
    parents: ['service:app'],
  },

  'container:devenv-db-1': {
    type: 'container',
    id: 'devenv-db-1',
    dashboardUid: 'adeuqybdrjugwc',
    parents: ['service:db'],
  },

  trace: {
    type: 'trace',
    id: 'ca37a2a47c6505d',
    dashboardUid: 'ddepip8sry6f4f',
  },
};

type Props = {
  entity: string;
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
  const onEntityChange = useCallback(
    (id: string) => {
      setNavStack([...navStack, entitiesMap[id]]);
    },
    [navStack]
  );

  useEffect(() => {
    const timeout = overrideLinks((id: string) => {
      const traceEntity = {
        ...entitiesMap['trace'],
        id,
      };
      setNavStack([...navStack, traceEntity]);
    });
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [navStack]);

  // This should rather be synchrnoized with the current time range of the parent view
  // but for testing this makes sense as default
  const dashInitialState = currentEntity.type === 'trace' ? '?var-traceid=' + currentEntity.id : '?from=now-15m&to=now';
  return (
    <Drawer closeOnMaskClick={true} onClose={props.onClose}>
      <Stack direction={'column'} gap={1}>
        <Stack direction={'row'} justifyContent={'space-between'} alignItems={'center'}>
          <Header
            stack={navStack}
            onBack={() => {
              setNavStack(navStack.slice(0, -1));
            }}
            onClose={props.onClose}
          />
        </Stack>
        {/*<EntityMap entity={currentEntity} onEntityChange={onEntityChange} />*/}
        {currentEntity.type !== 'trace' && <EntityMapAsserts entity={currentEntity} onEntityChange={onEntityChange} />}
        <div style={{ flex: '1', overflow: 'scroll', position: 'relative' }}>
          <EmbeddedDashboard uid={currentEntity.dashboardUid} initialState={dashInitialState} />
        </div>
      </Stack>
    </Drawer>
  );
}

function overrideLinks(tracelink: (id: string) => void): NodeJS.Timeout | undefined {
  // big hack as we cannot right now override how links are handled in the embedded dashboard so we just override
  // links in the dom. Silly but works.
  const nodes = document.querySelectorAll<HTMLAnchorElement>('a[href^="/explore" i]');
  if (nodes.length < 5) {
    return setTimeout(() => overrideLinks(tracelink), 1000);
  }

  for (const node of nodes) {
    node.onclick = (e) => {
      e.preventDefault();
      tracelink(node.innerText);
    };
  }
  return;
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

type EntityMapAssertsProps = {
  entity: Entity;
  onEntityChange: (entityId: string) => void;
};

function EntityMapAsserts({ onEntityChange, entity }: EntityMapAssertsProps) {
  const onNodeClick = useCallback(
    (id: string) => {
      onEntityChange(id);
    },
    [onEntityChange]
  );
  return (
    <div style={{ border: '1px solid lightgray' }}>
      <GraphinGraph
        data={entityToAssertsGraph(entity)}
        layout={DEFAULT_FORCE_LAYOUT_OPTIONS}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}

function entityToAssertsGraph(entity: Entity): GraphCustomData {
  const nodes: GraphCustomNode[] = [];
  const edges: GraphCustomEdge[] = [];
  nodes.push(toNode(entity));
  entity.children?.forEach((child) => {
    nodes.push(toNode(entitiesMap[child]));
    edges.push({
      source: entity.type + ':' + entity.id,
      target: child,
      trafficPresent: false,
      callsPerMinute: 0,
    });
  });
  entity.parents?.forEach((parent) => {
    nodes.push(toNode(entitiesMap[parent]));
    edges.push({
      source: parent,
      target: entity.type + ':' + entity.id,
      trafficPresent: false,
      callsPerMinute: 0,
    });
  });
  return { nodes, edges };
}

function toNode(entity: Entity): GraphCustomNode {
  return {
    id: entity.type + ':' + entity.id,
    entityType: {
      service: 'Service',
      namespace: 'Namespace',
      container: 'Pod',
    }[entity.type]!,
    type: 'asserts-node',
    hidden: false,
    label: entity.id,
    cluster: entity.type,
    scope: undefined,
    assertion: undefined,
    properties: {},
    connectedAssertion: undefined,
    style: {
      activeBgStroke: '#56595e',
      fill: '#D2B48C',
      fontColor: '#d0d3d8',
    },
  };
}

function Header(props: { stack: Entity[]; onBack: () => void; onClose: () => void }) {
  const current = props.stack.length === 1 ? props.stack[0] : props.stack[props.stack.length - 1];
  const prev = props.stack.length === 1 ? undefined : props.stack[props.stack.length - 2];
  return (
    <div style={{ flex: 1 }}>
      <Stack direction={'column'}>
        <Stack direction={'row'} alignItems={'center'} justifyContent={'space-between'}>
          <div style={{ display: 'flex' }}>
            {prev && (
              <>
                <IconButton name={'arrow-left'} onClick={props.onBack} aria-label={'back'} size={'xl'} />
                <span>{prev.id}</span>
              </>
            )}
          </div>
          <span>
            {current?.type}: {current?.id}{' '}
          </span>
          <IconButton name={'times'} onClick={props.onClose} aria-label={'close'} size={'xl'} />
        </Stack>
        <Stack direction={'row'} alignItems={'center'} justifyContent={'center'}>
          <Button
            onClick={() => {
              window.location.href = `/d/${current.dashboardUid}`;
            }}
            variant="secondary"
            icon={'external-link-alt'}
          >
            To dashboard
          </Button>
          <Button variant="secondary" icon={'external-link-alt'}>
            Add to incident
          </Button>
          <Button variant="secondary" icon={'external-link-alt'}>
            To App O11y
          </Button>
        </Stack>
      </Stack>
    </div>
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

export const DEFAULT_FORCE_LAYOUT_OPTIONS: LayoutConfig = {
  type: 'force',
  linkDistance: 100, // Edge length
  edgeStrength: 1,
  nodeStrength: -200,
  preventOverlap: true,
  collideStrength: 2,
  nodeSpacing: 40,
  nodeSize: (node: GraphCustomNode) => node.size,
  alpha: 0.3,
  alphaDecay: 0.028,
  alphaMin: 0.01,
  clustering: true,
  clusterNodeStrength: -5,
  clusterNodeSize: 80,
  clusterFociStrength: 1.2,
  // workerEnabled: true,
  // workerScriptURL: `${window.location.origin}/public/plugins/${pluginJson.id}${workerScript}`,
};
