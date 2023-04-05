import { css } from '@emotion/css';
import { isArray } from 'lodash';
import React from 'react';

import { SceneObject, SceneObjectBase } from '@grafana/scenes';
import { CodeEditor, Modal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { DashboardScene } from './DashboardScene';

export function viewAsTypescript(scene: DashboardScene) {
  appEvents.publish(
    new ShowModalReactEvent({
      component: ViewAsTypescriptModal,
      props: { scene },
    })
  );
}

interface ModalProps {
  onDismiss: () => void;
  scene: DashboardScene;
}

export function ViewAsTypescriptModal({ onDismiss, scene }: ModalProps) {
  const code = getTypescript(scene);

  return (
    <Modal
      isOpen={true}
      title="Scene typescript"
      onDismiss={onDismiss}
      className={css`
        width: 1200px;
      `}
    >
      <CodeEditor value={code} language="typescript" height={800} />
    </Modal>
  );
}

function getTypescript(scene: DashboardScene) {
  return `const scene = new EmbeddedScene({
  body: ${renderToTypescript(scene.state.body, 4)}
})`;
}

function renderToTypescript(obj: SceneObject, indent: number) {
  const indentStr = ' '.repeat(indent);
  let code = `new ${obj.constructor.name}({\n`;

  for (const key of Object.keys(obj.state)) {
    if (key === 'data') {
      continue;
    }

    code += `${indentStr}${key}: ${renderProperty((obj.state as any)[key], indent)}\n`;
  }

  return code + `}\n`;
}

function renderProperty(value: any, indent: number) {
  const indentStr = ' '.repeat(indent);

  if (value instanceof SceneObjectBase) {
    return renderToTypescript(value, indent + 2);
  }

  if (isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (value[0] instanceof SceneObjectBase) {
      let str = '[\n';
      for (const child of value) {
        str += indentStr + renderToTypescript(child, indent + 2);
      }

      return str + `\n${indentStr}]`;
    }
  }

  try {
    const json = JSON.stringify(value, null, 2);
    const lines = json.split('\n');
    if (lines.length > 2) {
      return `${lines[0]}\n${lines
        .slice(1)
        .map((l) => indentStr + l)
        .join('\n')}`;
    } else {
      return json;
    }
  } catch (e) {
    return 'exception';
  }
}
