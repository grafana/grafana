import React from 'react';

import { config } from '@grafana/runtime';
import { PageToolbar, ToolbarButton } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { PageLayoutType } from 'app/core/components/Page/types';

import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneComponentProps, SceneObjectStatePlain, SceneObject } from '../core/types';
import { UrlSyncManager } from '../services/UrlSyncManager';

import { SceneFlexChild } from './SceneFlexLayout';

interface SceneState extends SceneObjectStatePlain {
  title: string;
  children: SceneObject[];
  actions?: SceneObject[];
  isEditing?: boolean;
}

export class Scene extends SceneObjectBase<SceneState> {
  static Component = SceneRenderer;
  urlSyncManager?: UrlSyncManager;

  activate() {
    super.activate();
    this.urlSyncManager = new UrlSyncManager(this);
  }

  deactivate() {
    super.deactivate();
    this.urlSyncManager!.cleanUp();
  }
}

function SceneRenderer({ model }: SceneComponentProps<Scene>) {
  const { title, children, actions = [], isEditing, $editor } = model.useState();

  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if ($editor) {
    toolbarActions.push(
      <ToolbarButton
        icon="cog"
        variant={isEditing ? 'primary' : 'default'}
        onClick={() => model.setState({ isEditing: !model.state.isEditing })}
      />
    );
  }

  const pageToolbar = config.featureToggles.topnav ? (
    <AppChromeUpdate pageNav={{ text: title }} actions={toolbarActions} />
  ) : (
    <PageToolbar title={title}>{toolbarActions}</PageToolbar>
  );

  return (
    <Page navId="scenes" layout={PageLayoutType.Dashboard} toolbar={pageToolbar}>
      <div style={{ flexGrow: 1, display: 'flex', gap: '8px', overflow: 'auto' }}>
        {renderNodes(children, Boolean(isEditing))}
        {$editor && <$editor.Component model={$editor} isEditing={isEditing} />}
      </div>
    </Page>
  );
}

export function isDataProviderNode(node: SceneObject): node is SceneDataProviderNode {
  return node instanceof SceneDataProviderNode;
}

export function isFlexChildNode(node: SceneObject): node is SceneFlexChild {
  return node instanceof SceneFlexChild;
}

export function isTimeRangeNode(node: SceneObject): node is SceneTimeRange {
  return node instanceof SceneTimeRange;
}

export function renderNodes(nodes: SceneObject[], isEditing: boolean): React.ReactNode {
  return nodes.map((node) => {
    if (isDataProviderNode(node)) {
      return (
        <>
          <node.Component key={node.state.key} model={node} isEditing={isEditing} />
          {renderNodes(node.state.children, isEditing)}
        </>
      );
    }

    return <node.Component key={node.state.key} model={node} />;
  });
}
